from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, UploadFile, File, Header, Query, Response
from fastapi.responses import StreamingResponse, PlainTextResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import re
import ipaddress
import logging
import hmac
import hashlib
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional, Literal, Any, Dict
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt as pyjwt
import asyncio
import httpx
import requests

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGO = os.environ.get("JWT_ALGORITHM", "HS256")
JWT_HOURS = int(os.environ.get("JWT_EXPIRE_HOURS", "168"))
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
EMERGENT_EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY", "")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "NileNest")
EMAIL_REPLY_TO = os.environ.get("EMAIL_REPLY_TO")
EMAIL_BASE_URL = "https://integrations.emergentagent.com"
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
APP_NAME = os.environ.get("APP_NAME", "nilenest")
RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "").strip()
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "").strip()
RAZORPAY_ENABLED = bool(RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET)
_rzp_client = None
if RAZORPAY_ENABLED:
    try:
        import razorpay
        _rzp_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
    except Exception as _e:
        _rzp_client = None

# ---------- Object storage (Emergent) ----------
_storage_key = None

def init_storage(force: bool = False):
    global _storage_key
    if _storage_key and not force:
        return _storage_key
    if not EMERGENT_LLM_KEY:
        return None
    try:
        resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_LLM_KEY}, timeout=30)
        resp.raise_for_status()
        _storage_key = resp.json()["storage_key"]
        return _storage_key
    except Exception as e:
        logging.getLogger("nilenest").warning(f"Storage init failed: {e}")
        return None

def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    if not key:
        raise HTTPException(500, "Storage not available")
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data,
        timeout=120,
    )
    if resp.status_code in (403, 404):
        # try refresh
        key = init_storage(force=True)
        resp = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data,
            timeout=120,
        )
    resp.raise_for_status()
    return resp.json()

def get_object(path: str):
    key = init_storage()
    if not key:
        raise HTTPException(500, "Storage not available")
    resp = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key},
        timeout=60,
    )
    if resp.status_code == 404:
        raise HTTPException(404, "File not found")
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")

# ---------- Email (Resend via Emergent) — guardrail-gated ----------
_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = (
    "reply with your password", "reply with the code", "send your password",
    "cvv", "send us your password", "enter your password below",
    "confirm your card number", "your full card number", "seed phrase",
    "recovery phrase", "verify your card", "social security number",
    "confirm your bank details",
)
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tags = set()
        self.urls = []
        self.anchors = []
        self._href = None
        self._text = []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href = None
            self._text = []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan()
    scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Bad email URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor host mismatch: text={m.group(1)!r} real={real!r} (G3)")


async def send_email(*, to: str, subject: str, html: str, reply_to: Optional[str] = None) -> Optional[str]:
    if not EMERGENT_EMAIL_KEY:
        logging.getLogger("nilenest").info(f"Email skipped (no key). To: {to} Subject: {subject}")
        return None
    _assert_safe_email(subject, html)
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    if reply_to or EMAIL_REPLY_TO:
        payload["contact_email"] = reply_to or EMAIL_REPLY_TO
    try:
        async with httpx.AsyncClient(timeout=30) as ac:
            resp = await ac.post(
                f"{EMAIL_BASE_URL}/api/v1/email/send",
                headers={"X-Email-Key": EMERGENT_EMAIL_KEY},
                json=payload,
            )
        resp.raise_for_status()
        return resp.json().get("id")
    except Exception as e:
        logging.getLogger("nilenest").warning(f"Email send failed: {e}")
        return None


EMAIL_LOGO_URL = "https://customer-assets-m6fa6gv7.emergentagent.net/job_ayur-cart-2/artifacts/052dhc41_logo.png"


def _email_shell(subject_hint: str, body_html: str) -> str:
    """Consistent NileNest transactional email shell — logo, brand accents, footer."""
    return (
        '<div style="background:#F9F8F6;padding:24px 0;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Arial,sans-serif;color:#1A3A2F">'
        '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;margin:0 auto;background:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.04)">'
        '<tr><td align="center" style="padding:32px 24px 8px 24px">'
        f'<img src="{EMAIL_LOGO_URL}" alt="NileNest" width="140" style="display:block;max-width:140px;height:auto"/>'
        '</td></tr>'
        f'<tr><td style="padding:8px 32px 32px 32px">{body_html}</td></tr>'
        '<tr><td style="background:#EBE9E4;padding:22px 32px;font-size:12px;color:#5A6A63">'
        '<div style="font-family:Georgia,serif;font-size:14px;color:#1A3A2F;margin-bottom:6px">NileNest</div>'
        'Premium wellness essentials, traceable to a farm, a harvest, and a hand.<br/>'
        f'<a href="mailto:{escape(EMAIL_REPLY_TO or "care@nilenest.in")}" style="color:#8B1B1F;text-decoration:none">'
        f'{escape(EMAIL_REPLY_TO or "care@nilenest.in")}</a> · India-only shipping · FSSAI · India Organic · GMP'
        '</td></tr></table>'
        '<div style="max-width:600px;margin:12px auto 0;text-align:center;font-size:11px;color:#8B8B8B;padding:0 24px">'
        'We never ask for your password or card details by email.'
        '</div></div>'
    )


def _order_items_table(order: dict) -> str:
    rows = ""
    for i in order["items"]:
        img = escape(i.get("image", ""))
        img_cell = (f'<td width="64" style="padding-right:12px"><img src="{img}" alt="" width="56" height="56" '
                    f'style="display:block;width:56px;height:56px;object-fit:cover;border-radius:6px"/></td>') if img else ''
        rows += (
            f'<tr>{img_cell}<td style="padding:10px 0;border-bottom:1px solid #EBE9E4;font-size:14px">'
            f'<div style="color:#1A3A2F">{escape(i["title"])}</div>'
            f'<div style="color:#8B8B8B;font-size:12px">{escape(i["variant_name"])} × {i["quantity"]}</div>'
            f'</td><td align="right" style="padding:10px 0;border-bottom:1px solid #EBE9E4;font-size:14px;color:#1A3A2F">₹{int(i["line_total"])}</td></tr>'
        )
    totals = f'''
      <tr><td colspan="2" style="padding-top:14px;font-size:13px;color:#5A6A63">Subtotal</td>
          <td align="right" style="padding-top:14px;font-size:13px">₹{int(order["subtotal"])}</td></tr>'''
    if order.get("discount", 0) > 0:
        totals += f'<tr><td colspan="2" style="font-size:13px;color:#8B1B1F">Discount ({escape(order.get("coupon_code") or "")})</td><td align="right" style="font-size:13px;color:#8B1B1F">-₹{int(order["discount"])}</td></tr>'
    ship_val = "Free" if order.get("shipping", 0) == 0 else f"₹{int(order['shipping'])}"
    totals += f'<tr><td colspan="2" style="font-size:13px;color:#5A6A63">Shipping</td><td align="right" style="font-size:13px">{ship_val}</td></tr>'
    if order.get("tax", 0) > 0:
        totals += f'<tr><td colspan="2" style="font-size:13px;color:#5A6A63">Tax</td><td align="right" style="font-size:13px">₹{int(order["tax"])}</td></tr>'
    totals += f'<tr><td colspan="2" style="padding-top:8px;font-size:16px;font-family:Georgia,serif;color:#1A3A2F;border-top:1px solid #EBE9E4">Total</td><td align="right" style="padding-top:8px;font-size:16px;font-family:Georgia,serif;color:#1A3A2F;border-top:1px solid #EBE9E4">₹{int(order["total"])}</td></tr>'
    return f'<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:16px 0">{rows}{totals}</table>'


def _address_block(order: dict) -> str:
    a = order["address"]
    line2 = f'<div>{escape(a.get("line2",""))}</div>' if a.get("line2") else ''
    return (
        '<div style="background:#F5F4EF;padding:14px 16px;border-radius:8px;font-size:13px;line-height:1.55;color:#1A3A2F;margin:8px 0 4px 0">'
        f'<div style="font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#8B1B1F;margin-bottom:6px">Shipping to</div>'
        f'<div><strong>{escape(a["name"])}</strong></div>'
        f'<div>{escape(a["line1"])}</div>{line2}'
        f'<div>{escape(a["city"])}, {escape(a["state"])} {escape(a["pincode"])}</div>'
        f'<div style="color:#5A6A63;margin-top:4px">{escape(a["phone"])}</div>'
        '</div>'
    )


def _cta_button(label: str, href: str) -> str:
    return (
        f'<div style="margin:22px 0 6px 0"><a href="{escape(href)}" '
        f'style="display:inline-block;background:#1A3A2F;color:#F9F8F6;text-decoration:none;'
        f'padding:12px 28px;border-radius:999px;font-size:14px;font-weight:500">{escape(label)}</a></div>'
    )


STATUS_COPY = {
    "PLACED":     {"overline": "Order confirmed",   "headline": "Thank you, {first}.",              "message": "Your NileNest order <strong>#{num}</strong> is confirmed. We'll start preparing it with care today."},
    "PACKED":     {"overline": "Packed with care",  "headline": "Your order is packed, {first}.",   "message": "Your NileNest order <strong>#{num}</strong> is packed and handed off to our courier partner."},
    "SHIPPED":    {"overline": "On its way",        "headline": "Your NileNest is on the way.",     "message": "Order <strong>#{num}</strong> is now travelling to your door."},
    "DELIVERED":  {"overline": "Delivered",         "headline": "Delivered with love, {first}.",    "message": "Order <strong>#{num}</strong> has been delivered. We hope it becomes part of your everyday ritual."},
    "CANCELLED":  {"overline": "Order cancelled",   "headline": "Your order has been cancelled.",   "message": "Order <strong>#{num}</strong> has been cancelled. If you didn't request this, please reply to this email and we'll help right away."},
    "REFUNDED":   {"overline": "Refund initiated",  "headline": "Your refund is on the way.",       "message": "The refund for order <strong>#{num}</strong> has been initiated. Depending on your bank, it may take 5–7 business days to reflect."},
}


def _status_email_html(order: dict, status: str) -> str:
    copy = STATUS_COPY.get(status, STATUS_COPY["PLACED"])
    first = order["address"]["name"].split()[0] if order.get("address", {}).get("name") else "friend"
    num = order["order_number"]
    payment = order.get("payment_status", "")
    payment_line = f'<div style="font-size:12px;color:#5A6A63;margin-top:6px">Payment: <strong style="color:#1A3A2F">{escape(payment)}</strong> · {escape(order.get("payment_method",""))}</div>' if payment else ''
    tracking = ''
    if status in ("SHIPPED", "OUT_FOR_DELIVERY") and order.get("tracking_id"):
        tracking = f'<div style="font-size:13px;margin:14px 0"><span style="color:#5A6A63">Tracking ID:</span> <strong>{escape(order["tracking_id"])}</strong></div>'
    cta = _cta_button("Track your order", f"https://nilenest.in/track/{num}") if status not in ("CANCELLED", "REFUNDED") else ''
    body = (
        f'<div style="font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#8B1B1F;margin-top:8px">{copy["overline"]}</div>'
        f'<h1 style="font-family:Georgia,\'Times New Roman\',serif;font-size:26px;line-height:1.25;margin:8px 0 12px 0;color:#1A3A2F;font-weight:500">{escape(copy["headline"].format(first=first))}</h1>'
        f'<p style="font-size:14px;line-height:1.6;color:#3B4A44;margin:0 0 4px 0">{copy["message"].format(num=escape(num))}</p>'
        f'{payment_line}{tracking}'
        f'{_order_items_table(order)}'
        f'{_address_block(order)}'
        f'{cta}'
        f'<p style="font-size:13px;color:#5A6A63;margin-top:26px">Thank you for choosing NileNest — we\'re happy to be a small part of your wellness journey.</p>'
    )
    return _email_shell(status, body)


def _order_email_html(order: dict) -> str:
    return _status_email_html(order, order.get("status", "PLACED"))


def _shipping_email_html(order: dict) -> str:
    return _status_email_html(order, "SHIPPED")

app = FastAPI(title="NileNest API")
api = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("nilenest")


# ---------- utils ----------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def create_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_HOURS),
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


async def get_current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Optional[dict]:
    if not creds:
        return None
    try:
        payload = pyjwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGO])
    except Exception:
        return None
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    return user


async def require_user(user=Depends(get_current_user)) -> dict:
    if not user:
        raise HTTPException(401, "Authentication required")
    return user


async def require_admin(user=Depends(require_user)) -> dict:
    if user.get("role") not in ("admin", "editor"):
        raise HTTPException(403, "Admin/Editor role required")
    return user


async def require_admin_only(user=Depends(require_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin role required")
    return user


async def audit(actor_id: str, action: str, target: str, meta: Optional[dict] = None):
    await db.audit_log.insert_one(
        {
            "id": new_id(),
            "actor_id": actor_id,
            "action": action,
            "target": target,
            "meta": meta or {},
            "at": now_iso(),
        }
    )


# ---------- models ----------
class RegisterReq(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1)


class LoginReq(BaseModel):
    email: EmailStr
    password: str


class Address(BaseModel):
    label: Optional[str] = "Home"
    name: str
    phone: str
    line1: str
    line2: Optional[str] = ""
    city: str
    state: str
    pincode: str
    country: str = "India"


class Variant(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str
    sku: str
    weight_g: Optional[int] = None
    mrp: float
    price: float
    stock: int = 0
    stock_state: Literal["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"] = "IN_STOCK"


class Product(BaseModel):
    id: str = Field(default_factory=new_id)
    slug: str
    title: str
    subtitle: Optional[str] = ""
    category_id: str
    tagline: Optional[str] = ""
    description: str
    story: Optional[str] = ""
    ingredients: List[str] = []
    nutrition: Dict[str, str] = {}
    certifications: List[str] = []
    transparency: List[Dict[str, str]] = []
    images: List[str] = []
    tags: List[str] = []
    variants: List[Variant] = []
    is_active: bool = True
    is_featured: bool = False
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)
    updated_at: str = Field(default_factory=now_iso)


class Category(BaseModel):
    id: str = Field(default_factory=new_id)
    slug: str
    name: str
    description: Optional[str] = ""
    image: Optional[str] = ""


class CartItemIn(BaseModel):
    product_id: str
    variant_id: str
    quantity: int = 1


class CartPatch(BaseModel):
    product_id: str
    variant_id: str
    quantity: int


class Coupon(BaseModel):
    id: str = Field(default_factory=new_id)
    code: str
    type: Literal["PERCENT", "FLAT", "FREE_SHIPPING", "FIRST_ORDER"]
    value: float = 0
    min_subtotal: float = 0
    max_discount: Optional[float] = None
    active: bool = True
    expires_at: Optional[str] = None


class CheckoutReq(BaseModel):
    email: EmailStr
    address: Address
    coupon_code: Optional[str] = None
    delivery_method: Literal["STANDARD", "EXPRESS"] = "STANDARD"
    payment_method: Literal["MOCK", "COD"] = "MOCK"
    cart_id: Optional[str] = None


class OrderStatusUpdate(BaseModel):
    status: Literal["PLACED", "PACKED", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"]
    tracking_id: Optional[str] = None


class ShipmentUpdate(BaseModel):
    """Admin manual set / update of shipment fields on an order."""
    courier_slug: Optional[str] = None
    courier_name: Optional[str] = None
    shipment_id: Optional[str] = None
    awb: Optional[str] = None
    tracking_url: Optional[str] = None
    shipment_status: Optional[str] = None
    eta: Optional[str] = None


class TrackingEventIn(BaseModel):
    status: str
    note: Optional[str] = ""
    location: Optional[str] = ""
    at: Optional[str] = None


class Article(BaseModel):
    id: str = Field(default_factory=new_id)
    slug: str
    title: str
    excerpt: str
    body_html: str
    hero_image: str
    author: str = "NileNest Editorial"
    tags: List[str] = []
    related_product_ids: List[str] = []
    published: bool = True
    published_at: str = Field(default_factory=now_iso)


class CmsBlock(BaseModel):
    key: str
    data: Dict[str, Any]


class Review(BaseModel):
    id: str = Field(default_factory=new_id)
    product_id: str
    user_id: str
    user_name: str
    rating: int
    title: Optional[str] = ""
    body: str
    verified_purchase: bool = False
    created_at: str = Field(default_factory=now_iso)


class ChatReq(BaseModel):
    message: str
    session_id: Optional[str] = None
    context_product_id: Optional[str] = None


# ---------- helpers ----------
def stock_state(stock: int) -> str:
    if stock <= 0:
        return "OUT_OF_STOCK"
    if stock <= 5:
        return "LOW_STOCK"
    return "IN_STOCK"


def clean(doc: dict) -> dict:
    if not doc:
        return doc
    doc.pop("_id", None)
    return doc


async def get_or_create_cart(user_id: Optional[str], cart_id: Optional[str]) -> dict:
    if user_id:
        cart = await db.carts.find_one({"user_id": user_id}, {"_id": 0})
        if cart:
            return cart
    if cart_id:
        cart = await db.carts.find_one({"id": cart_id}, {"_id": 0})
        if cart:
            return cart
    cart = {
        "id": new_id(),
        "user_id": user_id,
        "items": [],
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.carts.insert_one(cart.copy())
    return cart


async def recalc_cart(cart: dict) -> dict:
    subtotal = 0.0
    mrp_total = 0.0
    hydrated_items = []
    for item in cart["items"]:
        product = await db.products.find_one({"id": item["product_id"]}, {"_id": 0})
        if not product:
            continue
        variant = next((v for v in product["variants"] if v["id"] == item["variant_id"]), None)
        if not variant:
            continue
        line_total = variant["price"] * item["quantity"]
        subtotal += line_total
        mrp_total += variant["mrp"] * item["quantity"]
        hydrated_items.append(
            {
                "product_id": product["id"],
                "variant_id": variant["id"],
                "slug": product["slug"],
                "title": product["title"],
                "variant_name": variant["name"],
                "image": product["images"][0] if product.get("images") else "",
                "price": variant["price"],
                "mrp": variant["mrp"],
                "quantity": item["quantity"],
                "line_total": round(line_total, 2),
                "stock_state": variant.get("stock_state", "IN_STOCK"),
            }
        )
    savings = round(mrp_total - subtotal, 2)
    cart["hydrated_items"] = hydrated_items
    cart["subtotal"] = round(subtotal, 2)
    cart["mrp_total"] = round(mrp_total, 2)
    cart["savings"] = savings
    cart["item_count"] = sum(i["quantity"] for i in hydrated_items)
    return cart


def apply_coupon(subtotal: float, coupon: Optional[dict], is_first_order: bool) -> dict:
    discount = 0.0
    free_shipping = False
    error = None
    if coupon:
        if not coupon.get("active"):
            error = "Coupon is inactive"
        elif subtotal < coupon.get("min_subtotal", 0):
            error = f"Minimum order ₹{coupon['min_subtotal']} required"
        elif coupon["type"] == "FIRST_ORDER" and not is_first_order:
            error = "Coupon valid for first-time orders only"
        else:
            t = coupon["type"]
            if t == "PERCENT":
                discount = subtotal * coupon["value"] / 100
                if coupon.get("max_discount"):
                    discount = min(discount, coupon["max_discount"])
            elif t == "FLAT":
                discount = min(subtotal, coupon["value"])
            elif t == "FIRST_ORDER":
                discount = min(subtotal, coupon.get("value", 0))
            elif t == "FREE_SHIPPING":
                free_shipping = True
    return {"discount": round(discount, 2), "free_shipping": free_shipping, "error": error}


def totals(subtotal: float, discount: float, free_shipping: bool, method: str) -> dict:
    shipping = 0.0
    if subtotal < 499 and not free_shipping:
        shipping = 49.0
    if method == "EXPRESS" and not free_shipping:
        shipping += 79.0
    tax = round((subtotal - discount) * 0.05, 2)
    total = round(subtotal - discount + shipping + tax, 2)
    return {
        "shipping": shipping,
        "tax": tax,
        "total": total,
    }


# ---------- health ----------
@api.get("/")
async def root():
    return {"service": "NileNest", "status": "ok"}


# ---------- auth ----------
@api.post("/auth/register")
async def register(req: RegisterReq):
    existing = await db.users.find_one({"email": req.email.lower()})
    if existing:
        raise HTTPException(400, "Email already registered")
    user = {
        "id": new_id(),
        "email": req.email.lower(),
        "name": req.name,
        "password_hash": hash_password(req.password),
        "role": "customer",
        "addresses": [],
        "preferences": {},
        "created_at": now_iso(),
    }
    await db.users.insert_one(user)
    token = create_token(user["id"], user["role"])
    user.pop("password_hash", None)
    user.pop("_id", None)
    return {"token": token, "user": user}


@api.post("/auth/login")
async def login(req: LoginReq):
    user = await db.users.find_one({"email": req.email.lower()})
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    token = create_token(user["id"], user["role"])
    user.pop("password_hash", None)
    user.pop("_id", None)
    return {"token": token, "user": user}


@api.get("/auth/me")
async def me(user=Depends(require_user)):
    return user


class AddressReq(BaseModel):
    address: Address


@api.post("/auth/addresses")
async def add_address(req: AddressReq, user=Depends(require_user)):
    addr = req.address.model_dump()
    addr["id"] = new_id()
    await db.users.update_one({"id": user["id"]}, {"$push": {"addresses": addr}})
    return addr


@api.delete("/auth/addresses/{addr_id}")
async def del_address(addr_id: str, user=Depends(require_user)):
    await db.users.update_one({"id": user["id"]}, {"$pull": {"addresses": {"id": addr_id}}})
    return {"ok": True}


# ---------- categories ----------
@api.get("/categories")
async def list_categories():
    return await db.categories.find({}, {"_id": 0}).to_list(100)


# ---------- products ----------
@api.get("/products")
async def list_products(
    category: Optional[str] = None,
    q: Optional[str] = None,
    tag: Optional[str] = None,
    featured: Optional[bool] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    sort: Optional[str] = None,
):
    query: Dict[str, Any] = {"is_active": True}
    if category:
        cat = await db.categories.find_one({"slug": category}, {"_id": 0})
        if cat:
            query["category_id"] = cat["id"]
    if tag:
        query["tags"] = tag
    if featured is not None:
        query["is_featured"] = featured
    if q:
        query["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
            {"tags": {"$regex": q, "$options": "i"}},
        ]
    products = await db.products.find(query, {"_id": 0}).to_list(500)
    if min_price is not None:
        products = [p for p in products if p["variants"] and p["variants"][0]["price"] >= min_price]
    if max_price is not None:
        products = [p for p in products if p["variants"] and p["variants"][0]["price"] <= max_price]
    if sort == "price_asc":
        products.sort(key=lambda p: p["variants"][0]["price"] if p["variants"] else 0)
    elif sort == "price_desc":
        products.sort(key=lambda p: -(p["variants"][0]["price"] if p["variants"] else 0))
    return products


@api.get("/products/{slug}")
async def get_product(slug: str):
    product = await db.products.find_one({"slug": slug}, {"_id": 0})
    if not product:
        raise HTTPException(404, "Product not found")
    reviews = await db.reviews.find({"product_id": product["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    product["reviews"] = reviews
    product["rating_avg"] = round(sum(r["rating"] for r in reviews) / len(reviews), 1) if reviews else 0
    product["rating_count"] = len(reviews)
    # rating breakdown 5..1
    breakdown = {str(i): 0 for i in range(1, 6)}
    for r in reviews:
        breakdown[str(int(r["rating"]))] = breakdown.get(str(int(r["rating"])), 0) + 1
    product["rating_breakdown"] = breakdown
    return product


# ---------- cart ----------
@api.get("/cart")
async def get_cart(cart_id: Optional[str] = None, user=Depends(get_current_user)):
    cart = await get_or_create_cart(user["id"] if user else None, cart_id)
    return await recalc_cart(cart)


@api.post("/cart/items")
async def add_to_cart(
    item: CartItemIn, cart_id: Optional[str] = None, user=Depends(get_current_user)
):
    cart = await get_or_create_cart(user["id"] if user else None, cart_id)
    found = False
    for existing in cart["items"]:
        if existing["product_id"] == item.product_id and existing["variant_id"] == item.variant_id:
            existing["quantity"] += item.quantity
            found = True
            break
    if not found:
        cart["items"].append(item.model_dump())
    cart["updated_at"] = now_iso()
    await db.carts.update_one(
        {"id": cart["id"]}, {"$set": {"items": cart["items"], "updated_at": cart["updated_at"]}}
    )
    return await recalc_cart(cart)


@api.patch("/cart/items")
async def update_cart(
    patch: CartPatch, cart_id: Optional[str] = None, user=Depends(get_current_user)
):
    cart = await get_or_create_cart(user["id"] if user else None, cart_id)
    if patch.quantity <= 0:
        cart["items"] = [
            i
            for i in cart["items"]
            if not (i["product_id"] == patch.product_id and i["variant_id"] == patch.variant_id)
        ]
    else:
        for existing in cart["items"]:
            if (
                existing["product_id"] == patch.product_id
                and existing["variant_id"] == patch.variant_id
            ):
                existing["quantity"] = patch.quantity
                break
    cart["updated_at"] = now_iso()
    await db.carts.update_one(
        {"id": cart["id"]}, {"$set": {"items": cart["items"], "updated_at": cart["updated_at"]}}
    )
    return await recalc_cart(cart)


@api.post("/cart/apply-coupon")
async def preview_coupon(payload: Dict[str, str], cart_id: Optional[str] = None, user=Depends(get_current_user)):
    cart = await get_or_create_cart(user["id"] if user else None, cart_id)
    cart = await recalc_cart(cart)
    code = payload.get("code", "").upper().strip()
    coupon = await db.coupons.find_one({"code": code}, {"_id": 0}) if code else None
    is_first = True
    if user:
        prior = await db.orders.count_documents({"user_id": user["id"]})
        is_first = prior == 0
    result = apply_coupon(cart["subtotal"], coupon, is_first)
    if not coupon and code:
        result["error"] = "Invalid coupon code"
    t = totals(cart["subtotal"], result["discount"], result["free_shipping"], "STANDARD")
    return {
        "coupon": coupon,
        "discount": result["discount"],
        "free_shipping": result["free_shipping"],
        "error": result["error"],
        **t,
        "subtotal": cart["subtotal"],
    }


# ---------- checkout & orders ----------
@api.post("/checkout")
async def checkout(req: CheckoutReq, user=Depends(get_current_user)):
    cart = await get_or_create_cart(user["id"] if user else None, req.cart_id)
    cart = await recalc_cart(cart)
    if not cart["hydrated_items"]:
        raise HTTPException(400, "Cart is empty")

    coupon = None
    if req.coupon_code:
        coupon = await db.coupons.find_one({"code": req.coupon_code.upper().strip()}, {"_id": 0})
    is_first = True
    if user:
        prior = await db.orders.count_documents({"user_id": user["id"]})
        is_first = prior == 0
    cres = apply_coupon(cart["subtotal"], coupon, is_first)
    if cres["error"] and coupon:
        raise HTTPException(400, cres["error"])
    t = totals(cart["subtotal"], cres["discount"], cres["free_shipping"], req.delivery_method)

    # decrement stock
    for item in cart["hydrated_items"]:
        await db.products.update_one(
            {"id": item["product_id"], "variants.id": item["variant_id"]},
            {"$inc": {"variants.$.stock": -item["quantity"]}},
        )
        # refresh stock_state
        prod = await db.products.find_one({"id": item["product_id"]}, {"_id": 0})
        if prod:
            for v in prod["variants"]:
                v["stock_state"] = stock_state(v["stock"])
            await db.products.update_one(
                {"id": prod["id"]}, {"$set": {"variants": prod["variants"]}}
            )

    order = {
        "id": new_id(),
        "order_number": "NN" + datetime.now().strftime("%y%m%d") + new_id()[:4].upper(),
        "user_id": user["id"] if user else None,
        "email": req.email.lower(),
        "address": req.address.model_dump(),
        "items": cart["hydrated_items"],
        "subtotal": cart["subtotal"],
        "mrp_total": cart["mrp_total"],
        "savings": cart["savings"],
        "discount": cres["discount"],
        "coupon_code": coupon["code"] if coupon else None,
        "shipping": t["shipping"],
        "tax": t["tax"],
        "total": t["total"],
        "delivery_method": req.delivery_method,
        "payment_method": req.payment_method,
        "payment_status": "PAID" if req.payment_method == "MOCK" else "PENDING",
        "status": "PLACED",
        "tracking_id": None,
        "timeline": [{"status": "PLACED", "at": now_iso(), "note": "Order received"}],
        "created_at": now_iso(),
    }
    await db.orders.insert_one(order.copy())
    # clear cart
    await db.carts.update_one({"id": cart["id"]}, {"$set": {"items": [], "updated_at": now_iso()}})
    order.pop("_id", None)
    # fire-and-forget order confirmation email
    try:
        await send_email(to=order["email"], subject=f"Your NileNest order {order['order_number']} is confirmed", html=_order_email_html(order))
    except Exception as e:
        log.warning(f"Confirmation email skipped: {e}")
    return order


# ---------- Razorpay ----------
class RazorpayCreateReq(BaseModel):
    cart_id: Optional[str] = None
    coupon_code: Optional[str] = None
    delivery_method: Literal["STANDARD", "EXPRESS"] = "STANDARD"


class RazorpayVerifyReq(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    email: EmailStr
    address: Address
    coupon_code: Optional[str] = None
    delivery_method: Literal["STANDARD", "EXPRESS"] = "STANDARD"
    cart_id: Optional[str] = None


@api.get("/config")
async def get_config():
    return {
        "razorpay_enabled": RAZORPAY_ENABLED,
        "razorpay_key_id": RAZORPAY_KEY_ID if RAZORPAY_ENABLED else None,
        "email_enabled": bool(EMERGENT_EMAIL_KEY),
        "storage_enabled": bool(EMERGENT_LLM_KEY),
    }


async def _compute_totals_for_cart(cart_id: Optional[str], user: Optional[dict], coupon_code: Optional[str], delivery_method: str):
    cart = await get_or_create_cart(user["id"] if user else None, cart_id)
    cart = await recalc_cart(cart)
    if not cart["hydrated_items"]:
        raise HTTPException(400, "Cart is empty")
    coupon = None
    if coupon_code:
        coupon = await db.coupons.find_one({"code": coupon_code.upper().strip()}, {"_id": 0})
    is_first = True
    if user:
        prior = await db.orders.count_documents({"user_id": user["id"]})
        is_first = prior == 0
    cres = apply_coupon(cart["subtotal"], coupon, is_first)
    if cres["error"] and coupon:
        raise HTTPException(400, cres["error"])
    t = totals(cart["subtotal"], cres["discount"], cres["free_shipping"], delivery_method)
    return cart, coupon, cres, t


@api.post("/checkout/razorpay/create")
async def rzp_create(req: RazorpayCreateReq, user=Depends(get_current_user)):
    if not RAZORPAY_ENABLED or _rzp_client is None:
        raise HTTPException(400, "Razorpay not configured")
    cart, coupon, cres, t = await _compute_totals_for_cart(req.cart_id, user, req.coupon_code, req.delivery_method)
    amount_paise = int(round(t["total"] * 100))
    receipt = ("NN" + datetime.now().strftime("%y%m%d%H%M%S"))[:40]
    try:
        rzp_order = _rzp_client.order.create({
            "amount": amount_paise, "currency": "INR", "receipt": receipt, "payment_capture": 1,
        })
    except Exception as e:
        raise HTTPException(500, f"Razorpay order failed: {e}")
    return {
        "razorpay_order_id": rzp_order["id"],
        "amount": amount_paise,
        "currency": "INR",
        "key_id": RAZORPAY_KEY_ID,
        "subtotal": cart["subtotal"],
        "discount": cres["discount"],
        "shipping": t["shipping"],
        "tax": t["tax"],
        "total": t["total"],
    }


@api.post("/checkout/razorpay/verify")
async def rzp_verify(req: RazorpayVerifyReq, user=Depends(get_current_user)):
    if not RAZORPAY_ENABLED or _rzp_client is None:
        raise HTTPException(400, "Razorpay not configured")
    msg = f"{req.razorpay_order_id}|{req.razorpay_payment_id}".encode()
    expected = hmac.new(RAZORPAY_KEY_SECRET.encode(), msg, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, req.razorpay_signature):
        raise HTTPException(400, "Invalid payment signature")
    cart, coupon, cres, t = await _compute_totals_for_cart(req.cart_id, user, req.coupon_code, req.delivery_method)
    # decrement stock
    for item in cart["hydrated_items"]:
        await db.products.update_one(
            {"id": item["product_id"], "variants.id": item["variant_id"]},
            {"$inc": {"variants.$.stock": -item["quantity"]}},
        )
        prod = await db.products.find_one({"id": item["product_id"]}, {"_id": 0})
        if prod:
            for v in prod["variants"]:
                v["stock_state"] = stock_state(v["stock"])
            await db.products.update_one({"id": prod["id"]}, {"$set": {"variants": prod["variants"]}})
    order = {
        "id": new_id(),
        "order_number": "NN" + datetime.now().strftime("%y%m%d") + new_id()[:4].upper(),
        "user_id": user["id"] if user else None,
        "email": req.email.lower(),
        "address": req.address.model_dump(),
        "items": cart["hydrated_items"],
        "subtotal": cart["subtotal"],
        "mrp_total": cart["mrp_total"],
        "savings": cart["savings"],
        "discount": cres["discount"],
        "coupon_code": coupon["code"] if coupon else None,
        "shipping": t["shipping"],
        "tax": t["tax"],
        "total": t["total"],
        "delivery_method": req.delivery_method,
        "payment_method": "RAZORPAY",
        "payment_status": "PAID",
        "razorpay_order_id": req.razorpay_order_id,
        "razorpay_payment_id": req.razorpay_payment_id,
        "status": "PLACED",
        "tracking_id": None,
        "timeline": [{"status": "PLACED", "at": now_iso(), "note": "Payment received"}],
        "created_at": now_iso(),
    }
    await db.orders.insert_one(order.copy())
    await db.carts.update_one({"id": cart["id"]}, {"$set": {"items": [], "updated_at": now_iso()}})
    order.pop("_id", None)
    try:
        await send_email(to=order["email"], subject=f"Your NileNest order {order['order_number']} is confirmed", html=_order_email_html(order))
    except Exception as e:
        log.warning(f"Confirmation email skipped: {e}")
    return order


@api.get("/orders/{order_number}")
async def get_order(order_number: str, user=Depends(get_current_user)):
    order = await db.orders.find_one({"order_number": order_number}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    if user and order.get("user_id") and order["user_id"] != user["id"]:
        if user.get("role") not in ("admin", "editor"):
            raise HTTPException(403, "Not your order")
    return order


@api.get("/orders")
async def my_orders(user=Depends(require_user)):
    orders = await db.orders.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return orders


# ---------- journal ----------
@api.get("/articles")
async def list_articles(tag: Optional[str] = None):
    q: Dict[str, Any] = {"published": True}
    if tag:
        q["tags"] = tag
    return await db.articles.find(q, {"_id": 0}).sort("published_at", -1).to_list(100)


@api.get("/articles/{slug}")
async def get_article(slug: str):
    article = await db.articles.find_one({"slug": slug}, {"_id": 0})
    if not article:
        raise HTTPException(404, "Article not found")
    related = []
    for pid in article.get("related_product_ids", []):
        p = await db.products.find_one({"id": pid}, {"_id": 0})
        if p:
            related.append(p)
    article["related_products"] = related
    return article


# ---------- CMS ----------
@api.get("/cms/{key}")
async def get_cms(key: str):
    block = await db.cms_blocks.find_one({"key": key}, {"_id": 0})
    if not block:
        return {"key": key, "data": {}}
    return block


# ---------- reviews ----------
class ReviewIn(BaseModel):
    product_id: str
    rating: int = Field(ge=1, le=5)
    title: Optional[str] = ""
    body: str = Field(min_length=4, max_length=2000)


@api.get("/reviews/eligibility")
async def review_eligibility(product_id: str, user=Depends(require_user)):
    has_order = await db.orders.find_one(
        {"user_id": user["id"], "items.product_id": product_id,
         "status": {"$nin": ["CANCELLED", "REFUNDED"]}}
    )
    has_reviewed = await db.reviews.find_one({"product_id": product_id, "user_id": user["id"]})
    return {
        "verified_purchase": bool(has_order),
        "has_reviewed": bool(has_reviewed),
        "can_review": bool(has_order) and not bool(has_reviewed),
    }


@api.post("/reviews")
async def create_review(review: ReviewIn, user=Depends(require_user)):
    # Verified buyers only
    has_order = await db.orders.find_one(
        {"user_id": user["id"], "items.product_id": review.product_id,
         "status": {"$nin": ["CANCELLED", "REFUNDED"]}}
    )
    if not has_order:
        raise HTTPException(403, "Only verified buyers can review this product")
    # One review per user per product
    existing = await db.reviews.find_one({"product_id": review.product_id, "user_id": user["id"]})
    if existing:
        raise HTTPException(400, "You have already reviewed this product")
    r = {
        "id": new_id(),
        "product_id": review.product_id,
        "user_id": user["id"],
        "user_name": user["name"],
        "rating": review.rating,
        "title": review.title or "",
        "body": review.body,
        "verified_purchase": True,
        "created_at": now_iso(),
    }
    await db.reviews.insert_one(r.copy())
    r.pop("_id", None)
    return r


@api.get("/reviews")
async def list_product_reviews(product_id: str):
    reviews = await db.reviews.find({"product_id": product_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return reviews


# ---------- AI Assistant (Gemini via Emergent) ----------
WELLNESS_PRIMER = """# Wellness topics you can discuss (education, not diagnosis)
- Skin health, hair & scalp health, digestion & gut wellness, liver wellness
- Heart & cardiovascular wellness, blood health & circulation, cholesterol & triglycerides
- Body fat, weight management, sustainable fat loss, energy & fatigue
- Immunity, nutrition basics, vitamins & minerals, protein & amino acids
- Sleep & recovery, stress & lifestyle, general fitness, men's wellness, women's wellness, healthy aging

# How to explain (plain language)
- Say "LDL is often called 'bad cholesterol'; when it stays high for a long time, it can contribute to plaque buildup in blood vessels" — not "hyperlipidemia is characterised by elevated serum LDL-C".
- Use short paragraphs, examples, and practical lifestyle guidance.
- Distinguish clearly between: (a) established nutritional role, (b) possible benefit, (c) limited evidence, (d) marketing claim.

# Ingredient education framework
When a user asks about an ingredient/nutrient (e.g. "what does Vitamin D do?", "what is ashwagandha?", "why is protein important?"), explain:
1. What it is
2. Its normal role in the body
3. Why it may be included in a product
4. What evidence generally says
5. Realistic expectations
6. Any relevant precautions

# Domain guidance
- Hair concerns: consider protein, iron, zinc, biotin, vitamin D, overall nutrition, stress, sleep, scalp health. Do NOT claim a product cures hair loss.
- Skin: hydration, protein, vitamins/minerals, antioxidants, sleep, sun exposure, skin barrier. Do NOT claim to cure acne/pigmentation/eczema.
- Heart / liver / blood / metabolic: educate broadly. Do NOT claim a supplement "cleans blood", "detoxes", "removes blockage", "cures fatty liver / diabetes / high cholesterol / heart disease".
- Fat loss: emphasise calorie balance, protein, activity, sleep, stress, consistency. NEVER promise kilograms lost in X weeks. NEVER say "this product burns belly fat" — say at most "may support your nutrition/weight-management routine".

# Safety escalation
Recommend consulting a qualified healthcare professional when the user is:
- Pregnant / breastfeeding
- A child or elderly with complex conditions
- Taking prescription medicines
- Managing a diagnosed disease
- Experiencing severe or persistent symptoms
- Describing symptoms that could indicate something serious (chest pain, sudden vision loss, uncontrolled bleeding, etc.)
Do NOT attempt to diagnose or prescribe."""


async def build_ai_context(product_id: Optional[str] = None) -> str:
    products = await db.products.find({"is_active": True}, {"_id": 0}).to_list(50)
    articles = await db.articles.find({"published": True}, {"_id": 0}).to_list(20)
    parts = ["# NileNest Product Catalog (this is the ONLY source of truth for product facts)"]
    for p in products:
        v = p["variants"][0] if p["variants"] else {"price": 0, "mrp": 0, "name": ""}
        parts.append(f"\n## {p['title']}  (slug: {p['slug']})")
        parts.append(f"- Price: ₹{v['price']} · Variant: {v['name']}")
        parts.append(f"- Tagline: {p.get('tagline','')}")
        parts.append(f"- Description: {p.get('description','')}")
        if p.get("ingredients"):
            parts.append(f"- Ingredients: {', '.join(p['ingredients'])}")
        if p.get("nutrition"):
            nut = ", ".join(f"{k}: {v_}" for k, v_ in p["nutrition"].items())
            parts.append(f"- Nutrition (per serving): {nut}")
        if p.get("certifications"):
            parts.append(f"- Certifications: {', '.join(p['certifications'])}")
        if p.get("transparency"):
            parts.append("- Transparency: " + " · ".join(f"{t['title']}: {t['value']}" for t in p["transparency"]))
        if p.get("tags"):
            parts.append(f"- Tags: {', '.join(p['tags'])}")
    parts.append("\n# NileNest Editorial Journal")
    for a in articles:
        parts.append(f"- {a['title']}: {a['excerpt']}")
    if product_id:
        p = next((x for x in products if x["id"] == product_id), None)
        if p:
            parts.append(f"\n# Currently on this product's page: {p['title']} (weight the conversation to this product when relevant, but still educate first).")
    return "\n".join(parts)


@api.post("/ai/chat")
async def ai_chat(req: ChatReq, user=Depends(get_current_user)):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(500, "AI not configured")

    from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone

    session_id = req.session_id or new_id()
    ctx = await build_ai_context(req.context_product_id)
    system = f"""You are the NileNest Wellness Guide — a warm, caring, family-oriented wellness companion for a premium D2C Indian brand. Think knowledgeable nutrition guide + caring family member + responsible wellness advisor. Never a salesperson, never a diagnosing doctor.

# NileNest philosophy (use naturally, do not repeat every turn)
NileNest was built around a simple idea: wellness should feel personal — the way a family member asks, "Are you eating properly?" or "How are you feeling today?" We want to help people understand their bodies, understand nutrition, make better everyday choices, and build sustainable habits.

# YOUR CORE CONVERSATION LOOP
For any wellness question, follow this order:
1. UNDERSTAND — Do not lead with a product. Reflect the concern back warmly.
2. ASK — If personalisation would meaningfully improve the answer, ask 1–3 gentle, relevant questions (age range, how long has it been happening, sleep, diet, medicines, main goal). Never overwhelm the user with a medical questionnaire. Never ask more than 3 questions in one turn.
3. EDUCATE — Explain the relevant health / nutrition factors in plain language.
4. INGREDIENTS — Discuss what nutrients or ingredients tend to matter for that goal.
5. PRODUCTS — Check the NileNest catalog. If a product genuinely fits, explain WHY (goal → nutritional factor → product ingredient → how to use → what to expect). If no product genuinely fits, say so clearly. Recommend at most 2 products.
6. EXPECTATIONS — Set realistic outcomes. Mention what the product CANNOT do.

# HARD RULES
- **No hallucination.** Never invent SKUs, prices, ingredients, nutrition facts, dosages, side effects, clinical studies, certifications or customer reviews. Use ONLY the NileNest catalog shown below. If information is missing, say: "I don't have enough verified information about that yet."
- **No diagnosis or prescription.** You may educate about conditions in general terms. You must not diagnose an individual or prescribe treatment.
- **No disease-cure claims** for any product: never say a NileNest product cures, treats or prevents hair loss, acne, eczema, diabetes, high cholesterol, fatty liver, heart disease, arthritis, cancer, or any illness. Never say "cleans blood", "detoxes", "removes blockage", "burns belly fat".
- **Fat loss** is about calorie balance, protein, activity, sleep, stress and consistency. Never promise kilograms or timeframes. A product may "support" a routine — nothing more.
- **Safety escalation** — if the user is pregnant, breastfeeding, a child, elderly with complex conditions, on prescription medicines, managing a diagnosed disease, or describing severe/persistent symptoms, recommend consulting a qualified healthcare professional before using supplements.
- **Dosage questions** — politely decline specific dosage prescriptions. Point to the serving size printed on the pack and suggest a qualified practitioner for individualised guidance.
- **Only NileNest products** — never recommend a competitor product. If NileNest does not have anything suitable, be honest.

# RESPONSE LENGTH & STYLE (critical)
- Default answer length: 2-4 short sentences OR a tight bullet list of 3-5 points. NEVER long essays.
- Answer the SPECIFIC question first. Facts and point-to-point solution, no unnecessary preface.
- Only expand into the full loop (understand → ask → educate → connect) when the user shares an OPEN-ENDED wellness concern like "my hair is falling" or "I want to lose weight". For direct factual questions ("what is tulsi?", "is your makhana gluten-free?", "which one is caffeine-free?") give a direct short answer with at most one clarifier if truly needed.
- Warm, caring, human, trustworthy, patient, non-judgmental — but concise.
- Plain language. No emojis. No exclamations. No hard-sell. No markdown headings.
- Bullet points are welcome for clarity.
- Never repeat the NileNest family story more than once per conversation.

# WHEN A PRODUCT IS RECOMMENDED, USE THIS SHAPE
"Based on what you've told me, your main goal seems to be ___.
For that goal, the factors that tend to matter most are ___.
Our ___ contains ___, which is why it may fit here.
Here's how to enjoy it: ___.
A few honest notes: it is not a treatment for ___, and results depend on your overall diet and lifestyle."

{WELLNESS_PRIMER}

{ctx}
"""
    chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=session_id, system_message=system).with_model(
        "gemini", "gemini-3-flash-preview"
    )

    await db.chat_messages.insert_one(
        {
            "id": new_id(),
            "session_id": session_id,
            "role": "user",
            "content": req.message,
            "at": now_iso(),
        }
    )

    async def event_gen():
        full = ""
        try:
            async for ev in chat.stream_message(UserMessage(text=req.message)):
                if isinstance(ev, TextDelta):
                    full += ev.content
                    yield f"data: {ev.content}\n\n".replace("\n\n", "\ue000").replace(
                        "\ue000", "\n\n"
                    )
                elif isinstance(ev, StreamDone):
                    break
        except Exception as e:
            log.exception("AI stream error")
            yield f"data: [error: {str(e)[:120]}]\n\n"
        yield "event: done\ndata: {}\n\n"
        await db.chat_messages.insert_one(
            {
                "id": new_id(),
                "session_id": session_id,
                "role": "assistant",
                "content": full,
                "at": now_iso(),
            }
        )

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "X-Session-Id": session_id},
    )


@api.post("/ai/recommend")
async def ai_recommend(payload: Dict[str, Any], user=Depends(get_current_user)):
    """Non-streaming quick recommender — returns 1-2 product slugs based on user goal."""
    if not EMERGENT_LLM_KEY:
        return {"recommendations": [], "message": ""}
    from emergentintegrations.llm.chat import LlmChat, UserMessage

    goal = payload.get("goal", "")
    products = await db.products.find({"is_active": True}, {"_id": 0}).to_list(50)
    catalog = "\n".join(
        [f"- slug={p['slug']} | {p['title']}: {p['description'][:150]} | ingredients={', '.join(p.get('ingredients', []))}" for p in products]
    )
    system = f"""You are the NileNest Wellness Guide. A visitor is on the homepage and has shared a wellness moment or goal.

Your task: pick 1–2 NileNest products from the exact catalog below that HONESTLY fit — or pick none if nothing fits well.

Respond STRICTLY in this format on a single line:
SLUGS: <slug1,slug2 or empty> | MESSAGE: <one caring sentence explaining WHY it fits their moment, or if no product fits, a warm sentence pointing them to lifestyle/nutrition guidance instead>

Rules:
- Never invent slugs. Only use slugs from the catalog.
- Never make disease-cure or "burn fat / detox / cleanse" claims.
- If the moment is a serious symptom or medical issue, recommend consulting a professional in MESSAGE and return SLUGS empty.
- Keep MESSAGE under 240 characters, warm and honest.

CATALOG:
{catalog}"""
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY, session_id=new_id(), system_message=system
    ).with_model("gemini", "gemini-3-flash-preview")
    try:
        resp = await chat.send_message(UserMessage(text=goal or "Recommend something calming for the evening."))
        text = str(resp)
        slugs_part, msg_part = "", text
        if "SLUGS:" in text:
            after = text.split("SLUGS:", 1)[1]
            if "|" in after:
                slugs_part, rest = after.split("|", 1)
                if "MESSAGE:" in rest:
                    msg_part = rest.split("MESSAGE:", 1)[1].strip()
        slugs = [s.strip() for s in slugs_part.split(",") if s.strip()][:2]
        recs = []
        for s in slugs:
            p = next((x for x in products if x["slug"] == s), None)
            if p:
                recs.append(p)
        return {"recommendations": recs, "message": msg_part.strip()[:280]}
    except Exception as e:
        log.exception("ai_recommend failed")
        return {"recommendations": products[:2], "message": "A gentle start for your ritual."}


# ---------- ADMIN ----------
@api.get("/admin/stats")
async def admin_stats(user=Depends(require_admin)):
    today = datetime.now(timezone.utc).date().isoformat()
    orders_today = await db.orders.count_documents({"created_at": {"$gte": today}})
    total_orders = await db.orders.count_documents({})
    all_orders = await db.orders.find({}, {"_id": 0, "total": 1, "created_at": 1}).to_list(2000)
    revenue = round(sum(o["total"] for o in all_orders), 2)
    revenue_today = round(sum(o["total"] for o in all_orders if o["created_at"] >= today), 2)
    low_stock_products = await db.products.find({}, {"_id": 0}).to_list(500)
    low_stock = []
    for p in low_stock_products:
        for v in p.get("variants", []):
            if v["stock"] <= 5:
                low_stock.append(
                    {"product": p["title"], "variant": v["name"], "stock": v["stock"]}
                )
    return {
        "orders_today": orders_today,
        "total_orders": total_orders,
        "revenue": revenue,
        "revenue_today": revenue_today,
        "low_stock": low_stock,
        "product_count": await db.products.count_documents({}),
        "customer_count": await db.users.count_documents({"role": "customer"}),
    }


@api.get("/admin/orders")
async def admin_orders(user=Depends(require_admin)):
    return await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)


# ---------- SHIPPING PROVIDER LAYER (provider-independent) ----------
# Abstract base + registry so any real courier (Shiprocket, Delhivery, Bluedart, DTDC…)
# can be added later without touching the customer-facing tracking flow.

INTERNAL_TIMELINE = [
    "PLACED", "PROCESSING", "PACKED", "SHIPPED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"
]


class ShippingProvider:
    """Contract every courier adapter must implement."""
    slug: str = "base"
    display_name: str = "Base"

    def is_serviceable(self, pincode: str) -> bool:
        return True

    async def create_shipment(self, order: dict) -> dict:
        raise NotImplementedError

    async def get_tracking(self, awb: str) -> dict:
        raise NotImplementedError

    def map_status(self, raw_status: str) -> str:
        """Map courier-specific status → NileNest internal timeline status."""
        s = (raw_status or "").upper()
        table = {
            "MANIFESTED": "PACKED", "READY TO SHIP": "PACKED",
            "PICKED UP": "SHIPPED", "PICKED": "SHIPPED", "DISPATCHED": "SHIPPED",
            "IN TRANSIT": "IN_TRANSIT", "IN-TRANSIT": "IN_TRANSIT", "TRANSIT": "IN_TRANSIT",
            "OUT FOR DELIVERY": "OUT_FOR_DELIVERY", "OFD": "OUT_FOR_DELIVERY",
            "DELIVERED": "DELIVERED", "COMPLETED": "DELIVERED",
            "RTO": "CANCELLED", "CANCELLED": "CANCELLED", "CANCELED": "CANCELLED",
        }
        return table.get(s, s or "SHIPPED")


class ManualProvider(ShippingProvider):
    """Default fallback provider. Admin sets AWB/URL/status by hand.
    Used until a real courier is configured with API credentials."""
    slug = "manual"
    display_name = "Manual (Admin)"

    async def create_shipment(self, order: dict) -> dict:
        return {"awb": None, "tracking_url": None, "shipment_id": None, "provider": self.slug}

    async def get_tracking(self, awb: str) -> dict:
        return {"events": [], "status": None, "eta": None}


class ShippingRegistry:
    """Registry so new providers can be added in one place. Provider selected by pincode/config."""
    def __init__(self):
        self._providers: Dict[str, ShippingProvider] = {}
        self.default_slug = "manual"

    def register(self, provider: ShippingProvider):
        self._providers[provider.slug] = provider

    def get(self, slug: Optional[str] = None) -> ShippingProvider:
        return self._providers.get(slug or self.default_slug) or self._providers["manual"]

    def pick_for_pincode(self, pincode: str) -> ShippingProvider:
        for p in self._providers.values():
            if p.slug != "manual" and p.is_serviceable(pincode):
                return p
        return self._providers["manual"]

    def list(self) -> List[Dict[str, str]]:
        return [{"slug": p.slug, "name": p.display_name} for p in self._providers.values()]


shipping_registry = ShippingRegistry()
shipping_registry.register(ManualProvider())


@api.get("/shipping/providers")
async def list_shipping_providers():
    return shipping_registry.list()


def _serviceable_pincode(pincode: str) -> bool:
    """Basic serviceability stub — real providers will call their API. India pincodes are 6 digits."""
    return bool(pincode and len(pincode) == 6 and pincode.isdigit())


@api.get("/shipping/serviceability")
async def check_serviceability(pincode: str):
    ok = _serviceable_pincode(pincode)
    provider = shipping_registry.pick_for_pincode(pincode) if ok else None
    return {
        "pincode": pincode,
        "serviceable": ok,
        "provider": provider.slug if provider else None,
        "provider_name": provider.display_name if provider else None,
        "eta_days": "3–6 business days" if ok else None,
    }


def _derive_shipment_status(order: dict) -> str:
    """Combine internal status + latest courier event into a single display status
    from INTERNAL_TIMELINE. Precedence: courier event > internal status."""
    events = order.get("courier_events") or []
    if events:
        last = events[-1].get("status")
        if last in INTERNAL_TIMELINE:
            return last
    internal = order.get("status", "PLACED")
    # Map admin transitions into finer-grained display statuses
    if internal == "PLACED":
        return "PLACED"
    if internal == "PACKED":
        return "PACKED"
    if internal == "SHIPPED":
        return "SHIPPED"
    if internal == "DELIVERED":
        return "DELIVERED"
    return internal


# ---------- Admin shipment management ----------
@api.patch("/admin/orders/{order_id}/shipment")
async def admin_update_shipment(order_id: str, upd: ShipmentUpdate, user=Depends(require_admin)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    payload = {k: v for k, v in upd.model_dump().items() if v is not None}
    if not payload:
        raise HTTPException(400, "Nothing to update")
    # Keep last_tracking_at fresh whenever any shipment field changes
    payload["last_tracking_at"] = now_iso()
    await db.orders.update_one({"id": order_id}, {"$set": payload})
    await audit(user["id"], "shipment.update", order_id, {"keys": list(payload.keys())})
    return {"ok": True}


@api.post("/admin/orders/{order_id}/tracking-event")
async def admin_add_tracking_event(order_id: str, ev: TrackingEventIn, user=Depends(require_admin)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    event = {
        "status": ev.status.upper().strip(),
        "note": ev.note or "",
        "location": ev.location or "",
        "at": ev.at or now_iso(),
        "source": "manual",
    }
    await db.orders.update_one(
        {"id": order_id},
        {"$push": {"courier_events": event}, "$set": {"last_tracking_at": now_iso()}},
    )
    await audit(user["id"], "shipment.event", order_id, {"status": event["status"]})
    return {"ok": True, "event": event}


# ---------- Public webhook (courier → NileNest) ----------
@api.post("/webhooks/shipping/{provider_slug}")
async def shipping_webhook(provider_slug: str, payload: Dict[str, Any], request: Request):
    """Courier posts tracking updates here. We accept the payload, normalize the status,
    append an event, and update the order's shipment_status. Never generates fake data."""
    awb = str(payload.get("awb") or payload.get("tracking_number") or "").strip()
    order_number = str(payload.get("order_number") or payload.get("reference") or "").strip()
    if not awb and not order_number:
        raise HTTPException(400, "awb or order_number required")
    query = {"awb": awb} if awb else {"order_number": order_number}
    order = await db.orders.find_one(query, {"_id": 0})
    if not order:
        # store as orphan for audit/retry rather than 404
        await db.shipping_orphans.insert_one({
            "id": new_id(), "provider": provider_slug, "payload": payload, "at": now_iso(),
        })
        return {"ok": False, "reason": "order_not_found", "stored_for_retry": True}
    provider = shipping_registry.get(provider_slug)
    raw = str(payload.get("status") or payload.get("event") or "").strip()
    mapped = provider.map_status(raw)
    event = {
        "status": mapped,
        "raw_status": raw,
        "note": payload.get("note") or payload.get("message") or "",
        "location": payload.get("location") or "",
        "at": payload.get("timestamp") or now_iso(),
        "source": provider_slug,
    }
    upd = {"$push": {"courier_events": event},
           "$set": {"last_tracking_at": now_iso(), "courier_slug": provider_slug,
                    "courier_name": payload.get("courier_name") or provider.display_name}}
    if payload.get("eta"):
        upd["$set"]["eta"] = payload["eta"]
    if payload.get("tracking_url"):
        upd["$set"]["tracking_url"] = payload["tracking_url"]
    upd["$set"]["shipment_status"] = mapped
    await db.orders.update_one({"id": order["id"]}, upd)
    return {"ok": True, "mapped_status": mapped}


@api.get("/orders/{order_number}/tracking")
async def get_order_tracking(order_number: str):
    """Public tracking endpoint — no auth so shared links work.
    Returns a NileNest-branded view; does NOT redirect to a courier website."""
    order = await db.orders.find_one({"order_number": order_number}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    events = order.get("courier_events") or []
    display_status = _derive_shipment_status(order)
    return {
        "order_number": order["order_number"],
        "internal_status": order.get("status"),
        "shipment_status": display_status,
        "courier_name": order.get("courier_name"),
        "courier_slug": order.get("courier_slug"),
        "awb": order.get("awb") or order.get("tracking_id"),
        "shipment_id": order.get("shipment_id"),
        "tracking_url": order.get("tracking_url"),
        "eta": order.get("eta"),
        "last_tracking_at": order.get("last_tracking_at"),
        "timeline_steps": INTERNAL_TIMELINE,
        "events": [
            {"status": e["status"], "note": e.get("note", ""),
             "location": e.get("location", ""), "at": e.get("at"),
             "source": e.get("source", "internal")}
            for e in events
        ],
        "order_timeline": order.get("timeline", []),  # internal admin transitions
        "items": order.get("items", []),
        "address": {
            "city": order.get("address", {}).get("city"),
            "state": order.get("address", {}).get("state"),
            "pincode": order.get("address", {}).get("pincode"),
        },
    }


@api.patch("/admin/orders/{order_id}")
async def admin_update_order(order_id: str, upd: OrderStatusUpdate, user=Depends(require_admin)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    order["timeline"].append(
        {"status": upd.status, "at": now_iso(), "note": f"Status → {upd.status}"}
    )
    upd_dict = {"status": upd.status, "timeline": order["timeline"]}
    if upd.tracking_id:
        upd_dict["tracking_id"] = upd.tracking_id
        order["tracking_id"] = upd.tracking_id
    await db.orders.update_one({"id": order_id}, {"$set": upd_dict})
    await audit(user["id"], "order.update", order_id, {"status": upd.status})
    # Send shipping email on SHIPPED
    if upd.status == "SHIPPED" and order.get("email"):
        try:
            order["status"] = "SHIPPED"
            await send_email(to=order["email"],
                             subject=f"NileNest — Your order #{order['order_number']} is on its way",
                             html=_status_email_html(order, "SHIPPED"))
        except Exception as e:
            log.warning(f"Shipping email skipped: {e}")
    elif upd.status == "DELIVERED" and order.get("email"):
        try:
            order["status"] = "DELIVERED"
            await send_email(to=order["email"],
                             subject=f"NileNest — Order #{order['order_number']} delivered",
                             html=_status_email_html(order, "DELIVERED"))
        except Exception as e:
            log.warning(f"Delivery email skipped: {e}")
    elif upd.status == "CANCELLED" and order.get("email"):
        try:
            order["status"] = "CANCELLED"
            await send_email(to=order["email"],
                             subject=f"NileNest — Order #{order['order_number']} cancelled",
                             html=_status_email_html(order, "CANCELLED"))
        except Exception as e:
            log.warning(f"Cancellation email skipped: {e}")
    elif upd.status == "REFUNDED" and order.get("email"):
        try:
            order["status"] = "REFUNDED"
            await send_email(to=order["email"],
                             subject=f"NileNest — Refund initiated for order #{order['order_number']}",
                             html=_status_email_html(order, "REFUNDED"))
        except Exception as e:
            log.warning(f"Refund email skipped: {e}")
    return {"ok": True}


# ---------- Admin upload (object storage) ----------
@api.post("/admin/upload")
async def admin_upload(file: UploadFile = File(...), user=Depends(require_admin)):
    ext = (file.filename or "bin").rsplit(".", 1)[-1].lower()
    if ext not in ("jpg", "jpeg", "png", "webp", "gif"):
        raise HTTPException(400, "Only image files (jpg, png, webp, gif) allowed")
    data = await file.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(400, "Max 5MB")
    path = f"{APP_NAME}/products/{new_id()}.{ext}"
    ct = file.content_type or f"image/{ 'jpeg' if ext=='jpg' else ext }"
    result = put_object(path, data, ct)
    await db.files.insert_one({
        "id": new_id(),
        "storage_path": result["path"],
        "original_filename": file.filename,
        "content_type": ct,
        "size": result.get("size", len(data)),
        "uploaded_by": user["id"],
        "is_deleted": False,
        "created_at": now_iso(),
    })
    return {"path": result["path"], "url": f"/api/files/{result['path']}"}


@api.get("/files/{path:path}")
async def serve_file(path: str):
    record = await db.files.find_one({"storage_path": path, "is_deleted": False})
    if not record:
        raise HTTPException(404, "File not found")
    data, ct = get_object(path)
    return Response(content=data, media_type=record.get("content_type", ct))


@api.post("/admin/products")
async def admin_create_product(product: Product, user=Depends(require_admin)):
    doc = product.model_dump()
    for v in doc["variants"]:
        v["stock_state"] = stock_state(v["stock"])
    await db.products.insert_one(doc.copy())
    await audit(user["id"], "product.create", doc["id"])
    doc.pop("_id", None)
    return doc


@api.patch("/admin/products/{product_id}")
async def admin_update_product(product_id: str, payload: Dict[str, Any], user=Depends(require_admin)):
    payload["updated_at"] = now_iso()
    if "variants" in payload:
        for v in payload["variants"]:
            v["stock_state"] = stock_state(v.get("stock", 0))
    await db.products.update_one({"id": product_id}, {"$set": payload})
    await audit(user["id"], "product.update", product_id, {"keys": list(payload.keys())})
    return {"ok": True}


@api.delete("/admin/products/{product_id}")
async def admin_delete_product(product_id: str, user=Depends(require_admin)):
    await db.products.delete_one({"id": product_id})
    await audit(user["id"], "product.delete", product_id)
    return {"ok": True}


@api.post("/admin/coupons")
async def admin_create_coupon(coupon: Coupon, user=Depends(require_admin)):
    doc = coupon.model_dump()
    doc["code"] = doc["code"].upper().strip()
    await db.coupons.insert_one(doc.copy())
    await audit(user["id"], "coupon.create", doc["id"])
    doc.pop("_id", None)
    return doc


@api.get("/admin/coupons")
async def admin_list_coupons(user=Depends(require_admin)):
    return await db.coupons.find({}, {"_id": 0}).to_list(200)


@api.delete("/admin/coupons/{coupon_id}")
async def admin_delete_coupon(coupon_id: str, user=Depends(require_admin)):
    await db.coupons.delete_one({"id": coupon_id})
    await audit(user["id"], "coupon.delete", coupon_id)
    return {"ok": True}


@api.post("/admin/articles")
async def admin_create_article(article: Article, user=Depends(require_admin)):
    doc = article.model_dump()
    await db.articles.insert_one(doc.copy())
    await audit(user["id"], "article.create", doc["id"])
    doc.pop("_id", None)
    return doc


@api.patch("/admin/articles/{article_id}")
async def admin_update_article(article_id: str, payload: Dict[str, Any], user=Depends(require_admin)):
    await db.articles.update_one({"id": article_id}, {"$set": payload})
    await audit(user["id"], "article.update", article_id)
    return {"ok": True}


@api.delete("/admin/articles/{article_id}")
async def admin_delete_article(article_id: str, user=Depends(require_admin)):
    await db.articles.delete_one({"id": article_id})
    await audit(user["id"], "article.delete", article_id)
    return {"ok": True}


@api.put("/admin/cms/{key}")
async def admin_update_cms(key: str, block: CmsBlock, user=Depends(require_admin)):
    await db.cms_blocks.update_one(
        {"key": key}, {"$set": {"key": key, "data": block.data, "updated_at": now_iso()}}, upsert=True
    )
    await audit(user["id"], "cms.update", key)
    return {"ok": True}


@api.get("/admin/audit-log")
async def admin_audit(user=Depends(require_admin)):
    return await db.audit_log.find({}, {"_id": 0}).sort("at", -1).to_list(300)


@api.get("/admin/customers")
async def admin_customers(user=Depends(require_admin)):
    return await db.users.find(
        {"role": "customer"}, {"_id": 0, "password_hash": 0}
    ).to_list(500)


# ---------- SEO ----------
@api.get("/seo/sitemap.xml", response_class=PlainTextResponse)
async def sitemap():
    base = "https://nilenest.in"
    urls = [f"{base}/", f"{base}/shop", f"{base}/journal", f"{base}/faq", f"{base}/transparency"]
    products = await db.products.find({"is_active": True}, {"_id": 0, "slug": 1}).to_list(500)
    articles = await db.articles.find({"published": True}, {"_id": 0, "slug": 1}).to_list(500)
    for p in products:
        urls.append(f"{base}/product/{p['slug']}")
    for a in articles:
        urls.append(f"{base}/journal/{a['slug']}")
    xml = '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    for u in urls:
        xml += f"<url><loc>{u}</loc></url>"
    xml += "</urlset>"
    return xml


@api.get("/seo/robots.txt", response_class=PlainTextResponse)
async def robots():
    return "User-agent: *\nAllow: /\nSitemap: /api/seo/sitemap.xml\n"


# ---------- seed ----------
async def seed_data():
    # admin
    if not await db.users.find_one({"email": "admin@nilenest.in"}):
        await db.users.insert_one(
            {
                "id": new_id(),
                "email": "admin@nilenest.in",
                "name": "NileNest Admin",
                "password_hash": hash_password("NileNest@2026"),
                "role": "admin",
                "addresses": [],
                "preferences": {},
                "created_at": now_iso(),
            }
        )
    if not await db.users.find_one({"email": "editor@nilenest.in"}):
        await db.users.insert_one(
            {
                "id": new_id(),
                "email": "editor@nilenest.in",
                "name": "NileNest Editor",
                "password_hash": hash_password("NileNest@2026"),
                "role": "editor",
                "addresses": [],
                "preferences": {},
                "created_at": now_iso(),
            }
        )

    # categories
    if await db.categories.count_documents({}) == 0:
        cats = [
            {
                "id": new_id(),
                "slug": "teas-infusions",
                "name": "Teas & Infusions",
                "description": "Slow-steeped rituals — hand-selected botanicals from Indian gardens.",
                "image": "https://images.unsplash.com/photo-1615227875116-ae28a77814fb?crop=entropy&cs=srgb&fm=jpg&q=85",
            },
            {
                "id": new_id(),
                "slug": "clean-snacks",
                "name": "Clean Snacks",
                "description": "Roasted, never fried. Nothing you can't pronounce.",
                "image": "https://images.unsplash.com/photo-1784676509476-6807c039b10f?crop=entropy&cs=srgb&fm=jpg&q=85",
            },
        ]
        await db.categories.insert_many(cats)

    tea_cat = await db.categories.find_one({"slug": "teas-infusions"})
    snack_cat = await db.categories.find_one({"slug": "clean-snacks"})

    # products
    if await db.products.count_documents({}) == 0:
        p1_variants = [
            {
                "id": new_id(),
                "name": "50g Loose Leaf",
                "sku": "NN-TEA-DV-50",
                "weight_g": 50,
                "mrp": 549,
                "price": 449,
                "stock": 42,
                "stock_state": "IN_STOCK",
            },
            {
                "id": new_id(),
                "name": "100g Loose Leaf",
                "sku": "NN-TEA-DV-100",
                "weight_g": 100,
                "mrp": 999,
                "price": 799,
                "stock": 28,
                "stock_state": "IN_STOCK",
            },
        ]
        p2_variants = [
            {
                "id": new_id(),
                "name": "80g Pouch",
                "sku": "NN-MAK-HP-80",
                "weight_g": 80,
                "mrp": 249,
                "price": 199,
                "stock": 60,
                "stock_state": "IN_STOCK",
            },
            {
                "id": new_id(),
                "name": "Pack of 3",
                "sku": "NN-MAK-HP-3PK",
                "weight_g": 240,
                "mrp": 699,
                "price": 549,
                "stock": 22,
                "stock_state": "IN_STOCK",
            },
        ]
        products = [
            {
                "id": new_id(),
                "slug": "daily-vitality-herbal-tea",
                "title": "Daily Vitality Herbal Tea",
                "subtitle": "A morning ritual of tulsi, ginger, and rose",
                "category_id": tea_cat["id"],
                "tagline": "Grounded mornings, gentle mind.",
                "description": "A restorative infusion of hand-picked tulsi from Uttarakhand foothills, fresh Kerala ginger, and Himalayan wild rose petals. Naturally caffeine-free. Slow-dried in single small batches to preserve the volatile aromatics.",
                "story": "Sourced from three family-owned gardens across the Himalayan and Western Ghats belts. Each harvest is traceable to a named grower.",
                "ingredients": [
                    "Tulsi (Krishna variant)",
                    "Ginger root",
                    "Rose petals",
                    "Cardamom",
                    "Green cardamom pods",
                ],
                "nutrition": {
                    "Serving": "2g",
                    "Calories": "0 kcal",
                    "Caffeine": "0 mg",
                    "Added Sugar": "0 g",
                    "Sodium": "0 mg",
                },
                "certifications": ["FSSAI Approved", "India Organic", "GMP Certified"],
                "transparency": [
                    {
                        "title": "Origin",
                        "value": "Uttarakhand, Kerala, Himachal Pradesh",
                    },
                    {"title": "Harvest", "value": "Winter 2025"},
                    {"title": "Batch Size", "value": "Under 40kg per batch"},
                    {"title": "Shelf Life", "value": "12 months from harvest"},
                ],
                "images": [
                    "https://images.unsplash.com/photo-1615227875116-ae28a77814fb?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NjV8MHwxfHNlYXJjaHwxfHxoZXJiYWwlMjB0ZWElMjBjdXAlMjBuYXR1cmFsJTIwbGlnaHRpbmd8ZW58MHx8fHwxNzg4MTkzNTI4fDA&ixlib=rb-4.1.0&q=85",
                    "https://images.unsplash.com/photo-1732534253010-0772d2ded674?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NjV8MHwxfHNlYXJjaHwyfHxoZXJiYWwlMjB0ZWElMjBjdXAlMjBuYXR1cmFsJTIwbGlnaHRpbmd8ZW58MHx8fHwxNzg4MTkzNTI4fDA&ixlib=rb-4.1.0&q=85",
                ],
                "tags": ["caffeine-free", "morning", "calming", "ayurveda"],
                "variants": p1_variants,
                "is_active": True,
                "is_featured": True,
                "seo_title": "Daily Vitality Herbal Tea — Tulsi, Ginger, Rose | NileNest",
                "seo_description": "A restorative caffeine-free infusion. Traceable botanicals from small Indian gardens.",
                "created_at": now_iso(),
                "updated_at": now_iso(),
            },
            {
                "id": new_id(),
                "slug": "himalayan-pink-salt-roasted-makhana",
                "title": "Himalayan Pink Salt Roasted Makhana",
                "subtitle": "Air-roasted lotus seeds. Nothing else.",
                "category_id": snack_cat["id"],
                "tagline": "Crisp, clean, unbothered.",
                "description": "Hand-picked fox nuts (makhana) from the Mithila belt of Bihar, air-roasted in small copper drums with a single pinch of Himalayan pink salt. Zero seed oils, zero preservatives, zero drama.",
                "story": "Every kilo is traceable to a Mithila-region cooperative that pays fair harvest wages to women farmers.",
                "ingredients": ["Makhana (fox nuts)", "Himalayan pink salt"],
                "nutrition": {
                    "Serving": "30g",
                    "Calories": "108 kcal",
                    "Protein": "3.4 g",
                    "Carbs": "22 g",
                    "Fats": "0.5 g",
                    "Sodium": "180 mg",
                },
                "certifications": ["FSSAI Approved", "Non-GMO", "Gluten Free"],
                "transparency": [
                    {"title": "Origin", "value": "Mithila, Bihar"},
                    {"title": "Roasting", "value": "Small-batch copper drum"},
                    {"title": "Oil Used", "value": "None"},
                    {"title": "Shelf Life", "value": "6 months from packaging"},
                ],
                "images": [
                    "https://images.unsplash.com/photo-1784676509476-6807c039b10f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzB8MHwxfHNlYXJjaHwyfHxyb2FzdGVkJTIwZm94JTIwbnV0JTIwbWFraGFuYSUyMGhlYWx0aHklMjBzbmFja3xlbnwwfHx8fDE3ODgxOTM1Mjh8MA&ixlib=rb-4.1.0&q=85",
                    "https://images.unsplash.com/photo-1711963915993-5967d3e64310?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NzN8MHwxfHNlYXJjaHw0fHxyb2FzdGVkJTIwZm94JTIwbnV0JTIwbWFraGFuYSUyMGhlYWx0aHklMjBzbmFja3xlbnwwfHx8fDE3ODgxOTM1Mjh8MA&ixlib=rb-4.1.0&q=85",
                ],
                "tags": ["snack", "protein", "gluten-free", "roasted"],
                "variants": p2_variants,
                "is_active": True,
                "is_featured": True,
                "seo_title": "Himalayan Pink Salt Roasted Makhana | NileNest",
                "seo_description": "Air-roasted lotus seeds with a single pinch of Himalayan pink salt. Nothing else.",
                "created_at": now_iso(),
                "updated_at": now_iso(),
            },
        ]
        await db.products.insert_many(products)

    # coupons
    if await db.coupons.count_documents({}) == 0:
        await db.coupons.insert_many(
            [
                {
                    "id": new_id(),
                    "code": "WELCOME10",
                    "type": "PERCENT",
                    "value": 10,
                    "min_subtotal": 0,
                    "max_discount": 200,
                    "active": True,
                    "expires_at": None,
                },
                {
                    "id": new_id(),
                    "code": "FREESHIP",
                    "type": "FREE_SHIPPING",
                    "value": 0,
                    "min_subtotal": 0,
                    "max_discount": None,
                    "active": True,
                    "expires_at": None,
                },
                {
                    "id": new_id(),
                    "code": "FIRSTBLOOM",
                    "type": "FIRST_ORDER",
                    "value": 150,
                    "min_subtotal": 499,
                    "max_discount": None,
                    "active": True,
                    "expires_at": None,
                },
            ]
        )

    # articles
    if await db.articles.count_documents({}) == 0:
        products = await db.products.find({}, {"_id": 0}).to_list(10)
        pids = [p["id"] for p in products]
        await db.articles.insert_many(
            [
                {
                    "id": new_id(),
                    "slug": "the-morning-ritual",
                    "title": "The Morning Ritual: Slower Starts, Better Days",
                    "excerpt": "Why the first ten minutes of your day matter more than the next ten hours.",
                    "body_html": "<p>There's a quiet grammar to a good morning — and it doesn't start with a screen. In our editorial, we explore the science and softness of slower starts, and how a single cup of tulsi-ginger tea can anchor an unhurried mind.</p><p>Prepare 200ml of water at a rolling boil. Add 2g of loose leaf. Steep, uncovered, for 4 minutes. That's it.</p>",
                    "hero_image": "https://images.unsplash.com/photo-1749137598868-94bde1951944?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NTN8MHwxfHNlYXJjaHwyfHxmb3Jlc3QlMjBncmVlbiUyMG5hdHVyZSUyMGx1eHVyeXxlbnwwfHx8fDE3ODgxOTM1Mzl8MA&ixlib=rb-4.1.0&q=85",
                    "author": "NileNest Editorial",
                    "tags": ["ritual", "morning"],
                    "related_product_ids": pids[:1],
                    "published": True,
                    "published_at": now_iso(),
                },
                {
                    "id": new_id(),
                    "slug": "the-case-for-makhana",
                    "title": "The Case for Makhana: An Ancient Snack, Rediscovered",
                    "excerpt": "How lotus seeds became the cleanest snack on your desk.",
                    "body_html": "<p>Long before puffed rice and popcorn, there was makhana — harvested from lotus ponds in the Mithila region of Bihar, dried in the sun, and roasted over slow flames. A single serving carries protein, calcium, and a satisfying crunch — without a single drop of seed oil.</p>",
                    "hero_image": "https://images.unsplash.com/photo-1730871083804-ceaeb8c08e79?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzB8MHwxfHNlYXJjaHwzfHxtaW5pbWFsaXN0JTIwdGVycmFjb3R0YSUyMGNsYXklMjBjdXB8ZW58MHx8fHwxNzg4MTkzNTI4fDA&ixlib=rb-4.1.0&q=85",
                    "author": "NileNest Editorial",
                    "tags": ["snack", "history"],
                    "related_product_ids": pids[1:2] if len(pids) > 1 else [],
                    "published": True,
                    "published_at": now_iso(),
                },
                {
                    "id": new_id(),
                    "slug": "traceability-matters",
                    "title": "Why Traceability Matters (More Than Certifications)",
                    "excerpt": "The single label promise every clean-food brand should make.",
                    "body_html": "<p>Certifications are floors, not ceilings. At NileNest, every batch is traceable to a named farm, a harvest date, and a small-batch roast. Certifications tell you what isn't there. Traceability tells you what is.</p>",
                    "hero_image": "https://images.unsplash.com/photo-1776975817012-c7a78c430e9e?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzB8MHwxfHNlYXJjaHwxfHxtaW5pbWFsaXN0JTIwdGVycmFjb3R0YSUyMGNsYXklMjBjdXB8ZW58MHx8fHwxNzg4MTkzNTI4fDA&ixlib=rb-4.1.0&q=85",
                    "author": "NileNest Editorial",
                    "tags": ["transparency", "sourcing"],
                    "related_product_ids": pids,
                    "published": True,
                    "published_at": now_iso(),
                },
            ]
        )

    # cms
    if await db.cms_blocks.count_documents({"key": "homepage"}) == 0:
        await db.cms_blocks.insert_one(
            {
                "key": "homepage",
                "data": {
                    "hero_overline": "New from NileNest",
                    "hero_headline": "Nature, unhurried.",
                    "hero_sub": "Premium wellness essentials, traceable to a farm, a harvest, and a hand.",
                    "hero_cta": "Explore the shop",
                    "hero_image": "https://images.unsplash.com/photo-1749137598868-94bde1951944?crop=entropy&cs=srgb&fm=jpg&q=85",
                    "trust_strip": [
                        "Traceable ingredients",
                        "Small-batch roasted",
                        "Zero seed oils",
                        "Free shipping over ₹499",
                    ],
                    "story_headline": "Founded in a farmhouse. Built in a lab.",
                    "story_body": "NileNest began between two kitchens — one in a Himalayan farmhouse, one in a Mumbai food-science lab. Each product is co-developed with the growers whose names appear on our transparency panel.",
                },
                "updated_at": now_iso(),
            }
        )


@app.on_event("startup")
async def on_startup():
    try:
        await seed_data()
        log.info("Seed complete")
    except Exception as e:
        log.exception(f"Seed failed: {e}")
    # storage init (non-blocking failure)
    try:
        if EMERGENT_LLM_KEY:
            init_storage()
            log.info("Storage initialized")
    except Exception as e:
        log.warning(f"Storage init failed: {e}")


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Session-Id"],
)


@app.on_event("shutdown")
async def shutdown():
    client.close()
