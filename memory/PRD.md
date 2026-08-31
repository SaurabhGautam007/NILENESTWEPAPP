# NileNest — PRD & Build Log

## Problem statement (verbatim)
Premium D2C wellness FMCG platform for a premium Indian brand launching with 2 SKUs (Daily Vitality Herbal Tea, Himalayan Pink Salt Roasted Makhana). Buildable v1 adapted from a 200-page blueprint: React + Vite/CRA + FastAPI + MongoDB (blueprint suggested Next.js + Spring). Server-authoritative commerce, PWA behavior, AI concierge grounded on internal catalog + journal, and admin panel.

## Stack (as built)
- Frontend: React 19 (CRA), React Router, TailwindCSS, shadcn/ui, sonner, Framer Motion
- Backend: FastAPI + Motor (Mongo) + bcrypt + PyJWT + emergentintegrations
- AI: Gemini 3 Flash via Emergent Universal Key (streaming SSE)
- Payments: Mock adapter (Razorpay adapter reserved) — production keys not yet provided
- Email: Deferred (add Resend post-launch)

## User personas
- B2C: health-conscious Indian consumers valuing transparency, clean labels, premium quality
- Admin: catalog/inventory/order manager
- Editor: journal + CMS content updates

## What's been implemented (v1 — Feb 2026)
### Storefront
- Ivory + Forest Green + Terracotta natural-luxury design system, Cormorant Garamond + Inter
- Configurable homepage (CMS-driven hero, trust strip, featured grid, story block)
- Shop with category tabs, search, sort
- PDP with variants, transparency panel accordion (ingredients / nutrition / origin / certifications), reviews rating
- Persistent server-recalculated cart via cart drawer
- Single-page accordion checkout (contact → address → delivery → coupon → payment → review)
- Order confirmation + tracking timeline
- Journal list + article detail with related products
- FAQ, Transparency, Contact pages
- 404 page
- Sitemap & robots endpoints

### Commerce
- Category + product + variant model
- Coupons: PERCENT, FLAT, FREE_SHIPPING, FIRST_ORDER — server-validated
- Server-computed subtotal, discount, shipping (free over ₹499), tax (5%), total
- Stock states (IN_STOCK / LOW_STOCK / OUT_OF_STOCK), decrement on checkout
- Reviews with verified-purchase flag

### Auth & account
- Email+password (JWT, bcrypt) — Admin + Editor + Customer
- Login / Register
- Account: order history + reorder
- Seed: `admin@nilenest.in` / `NileNest@2026` (admin), `editor@nilenest.in` / `NileNest@2026` (editor)

### AI Concierge
- Streaming SSE chat grounded on catalog + journal
- Refuses medical/dosage queries with a scripted response
- Homepage recommender (non-streaming) suggests 1-2 products by moment/goal

### Admin panel
- Dashboard (orders today, revenue, low stock)
- Orders list + status transitions with timeline + tracking ID auto-generated on SHIPPED
- Catalog stock editor
- Coupons CRUD
- Journal CRUD
- Customers (read-only)
- Audit log

## Prioritised backlog (post v1)
### Iteration 2 (Feb 2026) — DONE
- ✅ Razorpay integration: `/api/config`, `/api/checkout/razorpay/create`, `/api/checkout/razorpay/verify` (HMAC signature verified). Checkout auto-switches to Razorpay when RAZORPAY_KEY_ID/SECRET are set in `.env`. Frontend loads checkout.razorpay.com SDK on demand.
- ✅ Admin image upload via Emergent object storage: `/api/admin/upload` + `/api/files/{path}` server proxy; admin Catalog tab has upload widget with preview and remove.
- ✅ Order emails via Emergent-managed Resend with full guardrail gate (`_assert_safe_email`): confirmation email on `/api/checkout` and `/api/checkout/razorpay/verify`; shipping email on admin SHIPPED transition. Gracefully skips on failure so orders never break.
- ✅ Concierge context awareness: `AIContext` React context; PDP registers current product_id; AIChat forwards it as `context_product_id` and shows "Talking about the product you're viewing" label; PDP has an explicit "Ask the concierge about this product" CTA.

### P1 (open)
- OTP auth (MSG91/Twilio) as alternative sign-in
- Live shipping adapter (Shiprocket/Delhivery) + pincode serviceability
- Subscriptions & B2B pricing tier
- PWA manifest + service worker
### P2
- Multi-locale (i18n keys ready)
- Bundles + loyalty + referrals
- GA4/GTM

## Assumptions
- English + INR only
- India shipping only
- Manual fulfillment at launch
- Mock payment used until Razorpay keys provided
