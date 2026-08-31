import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { CheckCircle2, Circle } from "lucide-react";

const STEPS = ["PLACED", "PACKED", "SHIPPED", "DELIVERED"];

export default function OrderTracking() {
  const { orderNumber } = useParams();
  const [order, setOrder] = useState(null);
  useEffect(() => { api.get(`/orders/${orderNumber}`).then((r) => setOrder(r.data)); }, [orderNumber]);
  if (!order) return <div className="container-nl py-24 text-center text-muted-foreground">Loading…</div>;
  const idx = STEPS.indexOf(order.status);

  return (
    <section className="container-nl py-16 max-w-3xl">
      <div className="overline text-secondary">Order tracking</div>
      <h1 className="font-display text-4xl mt-2">{order.order_number}</h1>
      <p className="text-muted-foreground mt-2">{order.tracking_id ? `Tracking ID: ${order.tracking_id}` : "Preparing your order — tracking ID will appear once packed."}</p>

      <div className="mt-10 grid grid-cols-4 gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="text-center">
            {i <= idx ? <CheckCircle2 className="w-8 h-8 mx-auto text-secondary" /> : <Circle className="w-8 h-8 mx-auto text-border" />}
            <div className={`mt-2 text-xs tracking-wider uppercase ${i <= idx ? "text-primary" : "text-muted-foreground"}`}>{s}</div>
          </div>
        ))}
      </div>

      <div className="mt-10">
        <div className="overline text-muted-foreground mb-3">Timeline</div>
        <div className="border border-border rounded-md divide-y">
          {order.timeline.map((t, i) => (
            <div key={i} className="p-4 flex justify-between text-sm">
              <div><div className="font-medium">{t.status}</div><div className="text-xs text-muted-foreground">{t.note}</div></div>
              <div className="text-xs text-muted-foreground">{new Date(t.at).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
