import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, money } from "@/lib/api";
import { CheckCircle2 } from "lucide-react";
import { useCart } from "@/context/CartContext";

export default function OrderConfirm() {
  const { orderNumber } = useParams();
  const [order, setOrder] = useState(null);
  const { refresh } = useCart();

  useEffect(() => {
    api.get(`/orders/${orderNumber}`).then((r) => setOrder(r.data));
    refresh();
  }, [orderNumber, refresh]);

  if (!order) return <div className="container-nl py-24 text-center text-muted-foreground">Loading…</div>;
  return (
    <section className="container-nl py-16 max-w-3xl">
      <div className="flex items-center gap-3 text-secondary"><CheckCircle2 className="w-8 h-8" />
        <div>
          <div className="overline">Order placed</div>
          <h1 className="font-display text-4xl">Thank you, {order.address.name.split(" ")[0]}.</h1>
        </div>
      </div>
      <p className="mt-4 text-muted-foreground">Order <span className="text-primary font-medium">{order.order_number}</span> — a receipt has been queued to {order.email}.</p>

      <div className="grid md:grid-cols-2 gap-8 mt-10">
        <div className="bg-accent/40 p-6 rounded-md">
          <div className="overline text-muted-foreground mb-2">Shipping to</div>
          <div className="text-sm leading-relaxed">
            <div className="font-medium">{order.address.name}</div>
            <div>{order.address.line1}</div>
            {order.address.line2 && <div>{order.address.line2}</div>}
            <div>{order.address.city}, {order.address.state} {order.address.pincode}</div>
            <div className="mt-2 text-muted-foreground">{order.address.phone}</div>
          </div>
        </div>
        <div className="bg-accent/40 p-6 rounded-md">
          <div className="overline text-muted-foreground mb-2">Totals</div>
          <div className="text-sm space-y-1">
            <div className="flex justify-between"><span>Subtotal</span><span>{money(order.subtotal)}</span></div>
            {order.discount > 0 && <div className="flex justify-between text-secondary"><span>Discount</span><span>-{money(order.discount)}</span></div>}
            <div className="flex justify-between"><span>Shipping</span><span>{order.shipping === 0 ? "Free" : money(order.shipping)}</span></div>
            <div className="flex justify-between"><span>Tax</span><span>{money(order.tax)}</span></div>
            <div className="flex justify-between text-lg font-display pt-2 border-t border-border/60"><span>Total</span><span>{money(order.total)}</span></div>
          </div>
        </div>
      </div>

      <div className="mt-10">
        <div className="overline text-secondary mb-3">Your order</div>
        <div className="border border-border rounded-md divide-y">
          {order.items.map((i) => (
            <div key={i.variant_id} className="flex gap-4 p-4">
              <img src={i.image} alt="" className="w-20 h-20 object-cover rounded-md" />
              <div className="flex-1"><div className="font-medium">{i.title}</div><div className="text-xs text-muted-foreground">{i.variant_name} × {i.quantity}</div></div>
              <div>{money(i.line_total)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link to={`/track/${order.order_number}`} className="btn-primary">Track order</Link>
        <Link to="/shop" className="btn-ghost">Keep shopping</Link>
      </div>
    </section>
  );
}
