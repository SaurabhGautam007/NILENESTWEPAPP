"""Favicon verification tests for NileNest fix."""
import io
import os
import pytest
import requests
from PIL import Image

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://ayur-cart-2.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    return s


def _fetch(session, path):
    r = session.get(f"{BASE_URL}{path}", timeout=20)
    return r


def test_favicon_ico(session):
    r = _fetch(session, "/favicon.ico")
    assert r.status_code == 200, f"status={r.status_code}"
    assert len(r.content) > 0
    ct = r.headers.get("content-type", "").lower()
    # accept image/* or octet-stream (some CDNs)
    assert "image" in ct or "icon" in ct or "octet" in ct, f"content-type={ct}"
    # Verify PIL can open as ICO
    img = Image.open(io.BytesIO(r.content))
    assert img.format == "ICO", f"format={img.format}"


@pytest.mark.parametrize("path,expected_size", [
    ("/favicon-16.png", 16),
    ("/favicon-32.png", 32),
    ("/favicon-192.png", 192),
    ("/apple-touch-icon.png", 180),
])
def test_png_sizes(session, path, expected_size):
    r = _fetch(session, path)
    assert r.status_code == 200, f"{path} status={r.status_code}"
    assert len(r.content) > 0
    img = Image.open(io.BytesIO(r.content))
    assert img.format == "PNG", f"{path} format={img.format}"
    assert img.size == (expected_size, expected_size), f"{path} size={img.size}"
    # RGBA expected
    assert img.mode in ("RGBA", "RGB", "P"), f"{path} mode={img.mode}"


def _pixel_stats(img):
    """Return counts of greenish, reddish, blackish pixels."""
    img = img.convert("RGBA")
    w, h = img.size
    px = img.load()
    green = red = black = opaque = 0
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 30:
                continue
            opaque += 1
            # green: g clearly dominant
            if g > 80 and g > r + 20 and g > b - 10 and r < 200:
                green += 1
            # red/orange: r dominant
            if r > 120 and r > g + 20 and r > b + 20:
                red += 1
            # near-black
            if r < 60 and g < 60 and b < 60:
                black += 1
    return green, red, black, opaque


def test_mark_content_at_32(session):
    """Verify mark has green + red, and is not dominated by wordmark black text."""
    r = _fetch(session, "/favicon-32.png")
    assert r.status_code == 200
    img = Image.open(io.BytesIO(r.content))
    green, red, black, opaque = _pixel_stats(img)
    print(f"32px stats: green={green} red={red} black={black} opaque={opaque}")
    assert opaque > 50, "too few opaque pixels"
    assert green > 5, f"no green (leaves) pixels found: {green}"
    assert red > 3, f"no red/orange (arc) pixels found: {red}"
    # black should not dominate (wordmark cropped)
    assert black < opaque * 0.5, f"too many black pixels (wordmark likely present): {black}/{opaque}"


def test_mark_content_at_192(session):
    r = _fetch(session, "/favicon-192.png")
    assert r.status_code == 200
    img = Image.open(io.BytesIO(r.content))
    green, red, black, opaque = _pixel_stats(img)
    print(f"192px stats: green={green} red={red} black={black} opaque={opaque}")
    assert green > 100
    assert red > 50
    # Wordmark rows would be a long horizontal black band. Check width bands:
    w, h = img.size
    img_rgba = img.convert("RGBA")
    px = img_rgba.load()
    max_black_row = 0
    for y in range(h):
        row_black = sum(1 for x in range(w) if px[x, y][3] > 30 and px[x, y][0] < 60 and px[x, y][1] < 60 and px[x, y][2] < 60)
        max_black_row = max(max_black_row, row_black)
    print(f"max black pixels in a single row: {max_black_row}/{w}")
    # If wordmark were present, one row would be near full-width black
    assert max_black_row < w * 0.6, f"long horizontal black band detected: {max_black_row}"


def test_index_html_favicon_tags(session):
    r = _fetch(session, "/")
    assert r.status_code == 200
    html = r.text
    for token in ["favicon.ico", "favicon-32.png", "favicon-16.png", "favicon-192.png", "apple-touch-icon"]:
        assert token in html, f"missing {token} in index.html"
