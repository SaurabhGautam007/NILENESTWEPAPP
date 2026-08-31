import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, money, BACKEND } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { TID } from "@/constants/testIds";
import { toast } from "sonner";
import { CreditCard } from "lucide-react";

const loadRazorpay = () =>
  new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });

export default function Checkout() {
  const { cart, refresh } = useCart();
  const { user } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState(user?.email || "");
  const [addr, setAddr] = useState({ name: user?.name || "", phone: "", line1: "", line2: "", city: "", state: "", pincode: "" });
  const [delivery, setDelivery] = useState("STANDARD");
  const [coupon, setCoupon] = useState("");
  const [couponInfo, setCouponInfo] = useState(null);
  const [placing, setPlacing] = useState(false);
  const [config, setConfig] = useState({ razorpay_enabled: false });

  useEffect(() => {
    api.get("/config").then((r) => setConfig(r.data)).catch(() => {});
  }, []);

  useEffect(() => { if (user) { setEmail(user.email); setAddr((a) => ({ ...a, name: user.name })); } }, [user]);

  const applyCoupon = async () => {
    try {
      const cid = localStorage.getItem("nn_cart_id");
      const { data } = await api.post("/cart/apply-coupon", { code: coupon }, { params: cid ? { cart_id: cid } : {} });
      if (data.error) toast.error(data.error);
      else toast.success("Coupon applied");
      setCouponInfo(data);
    } catch (e) { toast.error("Could not apply coupon"); }
  };

  const shippingBase = cart.subtotal >= 499 ? 0 : 49;
  const shipping = (couponInfo?.free_shipping ? 0 : shippingBase) + (delivery === "EXPRESS" && !couponInfo?.free_shipping ? 79 : 0);
  const discount = couponInfo?.discount || 0;
  const tax = Math.round((cart.subtotal - discount) * 0.05);
  const total = cart.subtotal - discount + shipping + tax;

  const validate = () => {
    if (!email || !addr.name || !addr.phone || !addr.line1 || !addr.city || !addr.state || !addr.pincode) {
      toast.error("Please fill in your delivery details."); return false;
    }
    if (!cart.hydrated_items?.length) { toast.error("Your basket is empty."); return false; }
    return true;
  };

  const placeOrderMock = async () => {
    if (!validate()) return;
    setPlacing(true);
    try {
      const cid = localStorage.getItem("nn_cart_id");
      const { data } = await api.post("/checkout", {
        email, address: addr, coupon_code: couponInfo?.coupon?.code, delivery_method: delivery,
        payment_method: "MOCK", cart_id: cid,
      });
      toast.success("Order placed!");
      nav(`/order/${data.order_number}`);
    } catch (e) { toast.error(e.response?.data?.detail || "Checkout failed"); }
    finally { setPlacing(false); }
  };

  const placeOrderRazorpay = async () => {
    if (!validate()) return;
    setPlacing(true);
    try {
      const cid = localStorage.getItem("nn_cart_id");
      const { data: rzp } = await api.post("/checkout/razorpay/create", {
        cart_id: cid, coupon_code: couponInfo?.coupon?.code, delivery_method: delivery,
      });
      const ok = await loadRazorpay();
      if (!ok) { toast.error("Payment SDK failed to load"); setPlacing(false); return; }
      const opts = {
        key: rzp.key_id,
        amount: rzp.amount,
        currency: rzp.currency,
        order_id: rzp.razorpay_order_id,
        name: "NileNest",
        description: `Order · ${cart.hydrated_items.length} items`,
        prefill: { name: addr.name, email, contact: addr.phone },
        theme: { color: "#1A3A2F" },
        handler: async (resp) => {
          try {
            const { data: order } = await api.post("/checkout/razorpay/verify", {
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
              email, address: addr, coupon_code: couponInfo?.coupon?.code, delivery_method: delivery, cart_id: cid,
            });
            toast.success("Payment successful");
            refresh();
            nav(`/order/${order.order_number}`);
          } catch (e) { toast.error("Verification failed"); }
        },
        modal: { ondismiss: () => setPlacing(false) },
      };
      const rp = new window.Razorpay(opts);
      rp.on("payment.failed", () => { toast.error("Payment failed"); setPlacing(false); });
      rp.open();
    } catch (e) { toast.error(e.response?.data?.detail || "Could not start payment"); setPlacing(false); }
  };

  const placeOrder = config.razorpay_enabled ? placeOrderRazorpay : placeOrderMock;

  if (!cart.hydrated_items?.length) {
    return <div className="container-nl py-24 text-center">
      <h1 className="font-display text-3xl">Your basket is empty</h1>
      <p className="text-muted-foreground mt-3">Add something considered before checking out.</p>
    </div>;
  }

  return (
    <section className="container-nl py-10 lg:py-16 grid lg:grid-cols-12 gap-10">
      <div className="lg:col-span-7">
        <h1 className="font-display text-4xl mb-8">Checkout</h1>
        <Accordion type="multiple" defaultValue={["contact","address","delivery","coupon","payment"]}>
          <AccordionItem value="contact"><AccordionTrigger className="font-display text-xl">Contact</AccordionTrigger>
            <AccordionContent><input data-testid={TID.checkout.email} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" className="w-full border border-border rounded-md p-3 text-sm bg-transparent focus:outline-none focus:border-secondary" /></AccordionContent>
          </AccordionItem>
          <AccordionItem value="address"><AccordionTrigger className="font-display text-xl">Delivery Address</AccordionTrigger>
            <AccordionContent>
              <div className="grid sm:grid-cols-2 gap-3">
                <input data-testid={TID.checkout.name} value={addr.name} onChange={(e) => setAddr({...addr, name: e.target.value})} placeholder="Full name" className="border border-border rounded-md p-3 text-sm bg-transparent" />
                <input data-testid={TID.checkout.phone} value={addr.phone} onChange={(e) => setAddr({...addr, phone: e.target.value})} placeholder="Phone" className="border border-border rounded-md p-3 text-sm bg-transparent" />
                <input data-testid={TID.checkout.line1} value={addr.line1} onChange={(e) => setAddr({...addr, line1: e.target.value})} placeholder="Address line 1" className="sm:col-span-2 border border-border rounded-md p-3 text-sm bg-transparent" />
                <input value={addr.line2} onChange={(e) => setAddr({...addr, line2: e.target.value})} placeholder="Address line 2 (optional)" className="sm:col-span-2 border border-border rounded-md p-3 text-sm bg-transparent" />
                <input data-testid={TID.checkout.city} value={addr.city} onChange={(e) => setAddr({...addr, city: e.target.value})} placeholder="City" className="border border-border rounded-md p-3 text-sm bg-transparent" />
                <input data-testid={TID.checkout.state} value={addr.state} onChange={(e) => setAddr({...addr, state: e.target.value})} placeholder="State" className="border border-border rounded-md p-3 text-sm bg-transparent" />
                <input data-testid={TID.checkout.pincode} value={addr.pincode} onChange={(e) => setAddr({...addr, pincode: e.target.value})} placeholder="Pincode" className="border border-border rounded-md p-3 text-sm bg-transparent" />
              </div>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="delivery"><AccordionTrigger className="font-display text-xl">Delivery Method</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                {[
                  { v: "STANDARD", t: "Standard (4-6 days)", price: shippingBase },
                  { v: "EXPRESS", t: "Express (2-3 days)", price: shippingBase + 79 },
                ].map((o) => (
                  <label key={o.v} className={`flex items-center justify-between border rounded-md p-3 cursor-pointer ${delivery === o.v ? "border-primary bg-accent/40" : "border-border"}`}>
                    <div className="flex items-center gap-3"><input type="radio" checked={delivery === o.v} onChange={() => setDelivery(o.v)} /><span className="text-sm">{o.t}</span></div>
                    <span className="text-sm">{money(o.price)}</span>
                  </label>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="coupon"><AccordionTrigger className="font-display text-xl">Coupon</AccordionTrigger>
            <AccordionContent>
              <div className="flex gap-2">
                <input data-testid={TID.checkout.coupon} value={coupon} onChange={(e) => setCoupon(e.target.value)} placeholder="Try WELCOME10 or FREESHIP" className="flex-1 border border-border rounded-md p-3 text-sm bg-transparent" />
                <button data-testid={TID.checkout.applyCoupon} onClick={applyCoupon} className="btn-ghost">Apply</button>
              </div>
              {couponInfo?.coupon && !couponInfo?.error && <p className="text-xs text-secondary mt-2">{couponInfo.coupon.code} applied — you save {money(couponInfo.discount)}{couponInfo.free_shipping ? " · free shipping" : ""}</p>}
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="payment"><AccordionTrigger className="font-display text-xl">Payment</AccordionTrigger>
            <AccordionContent>
              <div className="p-4 bg-accent/40 rounded-md text-sm flex items-center gap-3">
                <CreditCard className="w-5 h-5 text-secondary" />
                {config.razorpay_enabled ? (
                  <div>
                    <div className="font-medium">Razorpay — cards, UPI, netbanking, wallets</div>
                    <p className="text-muted-foreground text-xs mt-1">Test card: 4111 1111 1111 1111, any future date, CVV 123.</p>
                  </div>
                ) : (
                  <div>
                    <div className="font-medium">Mock payment (Razorpay ready when keys are added)</div>
                    <p className="text-muted-foreground text-xs mt-1">Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend .env to activate real payments.</p>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      <aside className="lg:col-span-5">
        <div className="bg-accent/40 rounded-md p-6 sticky top-24">
          <h2 className="font-display text-2xl mb-4">Order Summary</h2>
          <div className="space-y-3 mb-4 max-h-[280px] overflow-y-auto">
            {cart.hydrated_items?.map((i) => (
              <div key={i.variant_id} className="flex gap-3">
                <img src={i.image} alt="" className="w-14 h-14 object-cover rounded-md" />
                <div className="flex-1 text-sm">
                  <div>{i.title}</div>
                  <div className="text-xs text-muted-foreground">{i.variant_name} × {i.quantity}</div>
                </div>
                <div className="text-sm">{money(i.line_total)}</div>
              </div>
            ))}
          </div>
          <div className="border-t border-border/60 pt-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{money(cart.subtotal)}</span></div>
            {discount > 0 && <div className="flex justify-between text-secondary"><span>Discount</span><span>-{money(discount)}</span></div>}
            <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span>{shipping === 0 ? "Free" : money(shipping)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Tax (5%)</span><span>{money(tax)}</span></div>
            <div className="flex justify-between text-lg pt-3 border-t border-border/60"><span className="font-display">Total</span><span className="font-medium">{money(total)}</span></div>
          </div>
          <button data-testid={TID.checkout.place} onClick={placeOrder} disabled={placing} className="btn-secondary w-full mt-6 disabled:opacity-40">
            {placing ? "Placing…" : config.razorpay_enabled ? `Pay with Razorpay · ${money(total)}` : `Place Order · ${money(total)}`}
          </button>
        </div>
      </aside>
    </section>
  );
}
