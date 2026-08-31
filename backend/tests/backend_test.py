"""NileNest backend regression tests.

Covers: auth, products, categories, articles, cart, coupons, checkout,
orders, admin RBAC & CRUD, audit, AI recommend, AI chat SSE, SEO.
"""
import os
import time
import uuid
import pytest
import requests

from pathlib import Path
_env = Path("/app/frontend/.env").read_text()
for _line in _env.splitlines():
    if _line.startswith("REACT_APP_BACKEND_URL="):
        os.environ.setdefault("REACT_APP_BACKEND_URL", _line.split("=", 1)[1].strip())
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@nilenest.in"
EDITOR_EMAIL = "editor@nilenest.in"
ADMIN_PW = "NileNest@2026"


# ---------------- fixtures ----------------
@pytest.fixture(scope="session")
def s():
    return requests.Session()


@pytest.fixture(scope="session")
def admin_token(s):
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PW}, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["user"]["role"] == "admin"
    return data["token"]


@pytest.fixture(scope="session")
def editor_token(s):
    r = s.post(f"{API}/auth/login", json={"email": EDITOR_EMAIL, "password": ADMIN_PW}, timeout=15)
    assert r.status_code == 200, r.text
    assert r.json()["user"]["role"] == "editor"
    return r.json()["token"]


@pytest.fixture(scope="session")
def customer(s):
    email = f"test-nn-{uuid.uuid4().hex[:8]}@example.com"
    r = s.post(f"{API}/auth/register", json={"email": email, "password": "Test@1234", "name": "NN Tester"}, timeout=15)
    assert r.status_code == 200, r.text
    j = r.json()
    return {"token": j["token"], "user": j["user"], "email": email}


def auth(tok):
    return {"Authorization": f"Bearer {tok}"}


# ---------------- catalog ----------------
class TestCatalog:
    def test_products_seeded(self, s):
        r = s.get(f"{API}/products", timeout=15)
        assert r.status_code == 200
        products = r.json()
        slugs = {p["slug"] for p in products}
        assert "daily-vitality-herbal-tea" in slugs
        assert "himalayan-pink-salt-roasted-makhana" in slugs
        for p in products:
            assert isinstance(p["variants"], list) and len(p["variants"]) >= 1

    def test_categories(self, s):
        r = s.get(f"{API}/categories", timeout=15)
        assert r.status_code == 200
        cats = r.json()
        slugs = {c["slug"] for c in cats}
        assert {"teas-infusions", "clean-snacks"}.issubset(slugs)

    def test_product_detail(self, s):
        r = s.get(f"{API}/products/daily-vitality-herbal-tea", timeout=15)
        assert r.status_code == 200
        p = r.json()
        assert p["title"]
        assert p["ingredients"]
        assert p["nutrition"]
        assert p["transparency"]
        assert "reviews" in p
        assert "rating_avg" in p

    def test_product_404(self, s):
        r = s.get(f"{API}/products/nope-xyz", timeout=15)
        assert r.status_code == 404


# ---------------- journal ----------------
class TestJournal:
    def test_articles(self, s):
        r = s.get(f"{API}/articles", timeout=15)
        assert r.status_code == 200
        arts = r.json()
        assert len(arts) >= 3

    def test_article_detail_related(self, s):
        r = s.get(f"{API}/articles/traceability-matters", timeout=15)
        assert r.status_code == 200
        a = r.json()
        assert isinstance(a.get("related_products"), list)
        assert len(a["related_products"]) >= 1


# ---------------- auth ----------------
class TestAuth:
    def test_register_and_me(self, s, customer):
        r = s.get(f"{API}/auth/me", headers=auth(customer["token"]), timeout=15)
        assert r.status_code == 200
        assert r.json()["email"] == customer["email"]
        assert r.json()["role"] == "customer"

    def test_login_admin(self, admin_token):
        assert admin_token

    def test_login_editor(self, editor_token):
        assert editor_token

    def test_login_bad(self, s):
        r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"}, timeout=15)
        assert r.status_code == 401

    def test_me_requires_auth(self, s):
        r = s.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 401


# ---------------- cart & coupons ----------------
@pytest.fixture
def customer_cart(s, customer):
    """Add one item to the customer's cart. Returns (token, cart)."""
    tok = customer["token"]
    # get products
    products = s.get(f"{API}/products").json()
    tea = next(p for p in products if p["slug"] == "daily-vitality-herbal-tea")
    v = tea["variants"][0]
    r = s.post(
        f"{API}/cart/items",
        json={"product_id": tea["id"], "variant_id": v["id"], "quantity": 2},
        headers=auth(tok),
        timeout=15,
    )
    assert r.status_code == 200, r.text
    cart = r.json()
    return {"token": tok, "cart": cart, "product": tea, "variant": v}


class TestCart:
    def test_add_and_recalc(self, customer_cart):
        cart = customer_cart["cart"]
        assert cart["item_count"] == 2
        assert cart["subtotal"] == round(customer_cart["variant"]["price"] * 2, 2)

    def test_update_quantity(self, s, customer_cart):
        tok = customer_cart["token"]
        p = customer_cart["product"]; v = customer_cart["variant"]
        r = s.patch(
            f"{API}/cart/items",
            json={"product_id": p["id"], "variant_id": v["id"], "quantity": 3},
            headers=auth(tok),
            timeout=15,
        )
        assert r.status_code == 200
        assert r.json()["item_count"] == 3

    def test_remove_by_zero(self, s, customer_cart):
        tok = customer_cart["token"]
        p = customer_cart["product"]; v = customer_cart["variant"]
        r = s.patch(
            f"{API}/cart/items",
            json={"product_id": p["id"], "variant_id": v["id"], "quantity": 0},
            headers=auth(tok),
            timeout=15,
        )
        assert r.status_code == 200
        assert r.json()["item_count"] == 0


class TestCoupons:
    def test_welcome10_capped(self, s, customer_cart):
        tok = customer_cart["token"]
        # ensure item present
        p = customer_cart["product"]; v = customer_cart["variant"]
        s.post(f"{API}/cart/items", json={"product_id": p["id"], "variant_id": v["id"], "quantity": 2}, headers=auth(tok))
        r = s.post(f"{API}/cart/apply-coupon", json={"code": "WELCOME10"}, headers=auth(tok), timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["error"] is None
        assert data["discount"] > 0
        assert data["discount"] <= 200

    def test_freeship(self, s, customer_cart):
        tok = customer_cart["token"]
        r = s.post(f"{API}/cart/apply-coupon", json={"code": "FREESHIP"}, headers=auth(tok), timeout=15)
        assert r.status_code == 200
        assert r.json()["free_shipping"] is True

    def test_invalid_coupon(self, s, customer_cart):
        tok = customer_cart["token"]
        r = s.post(f"{API}/cart/apply-coupon", json={"code": "NOPE123"}, headers=auth(tok), timeout=15)
        assert r.status_code == 200
        assert "Invalid" in (r.json().get("error") or "")


# ---------------- checkout & orders ----------------
@pytest.fixture(scope="session")
def placed_order(s, customer):
    tok = customer["token"]
    products = s.get(f"{API}/products").json()
    tea = next(p for p in products if p["slug"] == "daily-vitality-herbal-tea")
    v = tea["variants"][0]
    # ensure cart populated
    s.post(f"{API}/cart/items", json={"product_id": tea["id"], "variant_id": v["id"], "quantity": 1}, headers=auth(tok))
    # snapshot stock
    before = s.get(f"{API}/products/daily-vitality-herbal-tea").json()
    stock_before = next(x["stock"] for x in before["variants"] if x["id"] == v["id"])
    payload = {
        "email": customer["email"],
        "address": {
            "name": "NN Tester", "phone": "9999999999",
            "line1": "1 Test Rd", "city": "Mumbai", "state": "MH", "pincode": "400001", "country": "India",
        },
        "delivery_method": "STANDARD",
        "payment_method": "MOCK",
    }
    r = s.post(f"{API}/checkout", json=payload, headers=auth(tok), timeout=20)
    assert r.status_code == 200, r.text
    order = r.json()
    assert order["status"] == "PLACED"
    assert order["order_number"].startswith("NN")
    assert order["payment_status"] == "PAID"
    # stock decremented
    after = s.get(f"{API}/products/daily-vitality-herbal-tea").json()
    stock_after = next(x["stock"] for x in after["variants"] if x["id"] == v["id"])
    assert stock_after < stock_before
    # cart cleared
    cart_after = s.get(f"{API}/cart", headers=auth(tok)).json()
    assert cart_after["item_count"] == 0
    return {"token": tok, "order": order}


class TestOrders:
    def test_get_order_by_number(self, s, placed_order):
        num = placed_order["order"]["order_number"]
        r = s.get(f"{API}/orders/{num}", headers=auth(placed_order["token"]), timeout=15)
        assert r.status_code == 200
        assert r.json()["order_number"] == num

    def test_my_orders(self, s, placed_order):
        r = s.get(f"{API}/orders", headers=auth(placed_order["token"]), timeout=15)
        assert r.status_code == 200
        assert any(o["order_number"] == placed_order["order"]["order_number"] for o in r.json())

    def test_my_orders_requires_auth(self, s):
        r = s.get(f"{API}/orders", timeout=15)
        assert r.status_code == 401


# ---------------- admin RBAC & flow ----------------
class TestAdminRBAC:
    def test_no_token(self, s):
        r = s.get(f"{API}/admin/stats", timeout=15)
        assert r.status_code == 401

    def test_customer_token_forbidden(self, s, customer):
        r = s.get(f"{API}/admin/stats", headers=auth(customer["token"]), timeout=15)
        assert r.status_code == 403

    def test_admin_stats(self, s, admin_token):
        r = s.get(f"{API}/admin/stats", headers=auth(admin_token), timeout=15)
        assert r.status_code == 200
        for k in ("orders_today", "total_orders", "revenue", "product_count"):
            assert k in r.json()


class TestAdminOrderFlow:
    def test_transitions(self, s, admin_token, placed_order):
        order_id = placed_order["order"]["id"]
        for status_ in ["PACKED", "SHIPPED", "DELIVERED"]:
            body = {"status": status_}
            if status_ == "SHIPPED":
                body["tracking_id"] = "TRK-" + uuid.uuid4().hex[:6].upper()
            r = s.patch(f"{API}/admin/orders/{order_id}", json=body, headers=auth(admin_token), timeout=15)
            assert r.status_code == 200, r.text
        # verify timeline & final status
        num = placed_order["order"]["order_number"]
        r = s.get(f"{API}/orders/{num}", headers=auth(admin_token), timeout=15)
        assert r.status_code == 200
        o = r.json()
        assert o["status"] == "DELIVERED"
        assert o["tracking_id"]
        statuses = [t["status"] for t in o["timeline"]]
        for s_ in ["PLACED", "PACKED", "SHIPPED", "DELIVERED"]:
            assert s_ in statuses


class TestAdminCRUD:
    def test_coupon_crud(self, s, admin_token):
        code = f"TEST{uuid.uuid4().hex[:5].upper()}"
        payload = {"code": code, "type": "PERCENT", "value": 5, "min_subtotal": 0, "max_discount": 100, "active": True}
        r = s.post(f"{API}/admin/coupons", json=payload, headers=auth(admin_token), timeout=15)
        assert r.status_code == 200
        cid = r.json()["id"]
        listed = s.get(f"{API}/admin/coupons", headers=auth(admin_token)).json()
        assert any(c["id"] == cid for c in listed)
        r = s.delete(f"{API}/admin/coupons/{cid}", headers=auth(admin_token), timeout=15)
        assert r.status_code == 200
        listed = s.get(f"{API}/admin/coupons", headers=auth(admin_token)).json()
        assert all(c["id"] != cid for c in listed)

    def test_article_crud(self, s, admin_token):
        art = {
            "slug": f"test-art-{uuid.uuid4().hex[:6]}",
            "title": "TEST_Article",
            "excerpt": "e", "body_html": "<p>x</p>", "hero_image": "http://x",
            "tags": ["test"], "related_product_ids": [], "published": True,
        }
        r = s.post(f"{API}/admin/articles", json=art, headers=auth(admin_token), timeout=15)
        assert r.status_code == 200
        aid = r.json()["id"]
        r = s.delete(f"{API}/admin/articles/{aid}", headers=auth(admin_token), timeout=15)
        assert r.status_code == 200

    def test_product_stock_state(self, s, admin_token):
        products = s.get(f"{API}/products").json()
        p = products[0]
        # create low stock variant
        variants = [
            {**p["variants"][0], "stock": 3},  # LOW_STOCK
            {**p["variants"][1], "stock": 0} if len(p["variants"]) > 1 else {**p["variants"][0], "stock": 0, "id": str(uuid.uuid4()), "sku": "TMP"},
        ]
        r = s.patch(
            f"{API}/admin/products/{p['id']}", json={"variants": variants}, headers=auth(admin_token), timeout=15
        )
        assert r.status_code == 200
        got = s.get(f"{API}/products/{p['slug']}").json()
        assert got["variants"][0]["stock_state"] == "LOW_STOCK"
        assert got["variants"][1]["stock_state"] == "OUT_OF_STOCK"
        # restore
        restored = [{**v, "stock": 50} for v in got["variants"]]
        s.patch(f"{API}/admin/products/{p['id']}", json={"variants": restored}, headers=auth(admin_token))


class TestAudit:
    def test_audit_records_actor(self, s, admin_token):
        r = s.get(f"{API}/admin/audit-log", headers=auth(admin_token), timeout=15)
        assert r.status_code == 200
        entries = r.json()
        assert len(entries) >= 1
        assert all("actor_id" in e and "action" in e and "target" in e for e in entries[:5])


# ---------------- AI ----------------
class TestAI:
    def test_recommend(self, s):
        r = s.post(f"{API}/ai/recommend", json={"goal": "something calming in the evening"}, timeout=60)
        assert r.status_code == 200
        data = r.json()
        assert "recommendations" in data
        assert 1 <= len(data["recommendations"]) <= 2

    def test_chat_sse(self, s):
        with s.post(
            f"{API}/ai/chat",
            json={"message": "Tell me about the Daily Vitality Herbal Tea in one line."},
            stream=True,
            timeout=60,
        ) as r:
            assert r.status_code == 200
            ct = r.headers.get("content-type", "")
            assert "text/event-stream" in ct
            # read a couple of chunks
            got_data = False
            start = time.time()
            for line in r.iter_lines(decode_unicode=True):
                if line and line.startswith("data:"):
                    got_data = True
                if line and line.startswith("event: done"):
                    break
                if time.time() - start > 45:
                    break
            assert got_data


# ---------------- SEO ----------------
class TestSEO:
    def test_sitemap(self, s):
        r = s.get(f"{API}/seo/sitemap.xml", timeout=15)
        assert r.status_code == 200
        assert "<urlset" in r.text
        assert "daily-vitality-herbal-tea" in r.text
        assert "traceability-matters" in r.text

    def test_robots(self, s):
        r = s.get(f"{API}/seo/robots.txt", timeout=15)
        assert r.status_code == 200
        assert "User-agent" in r.text
