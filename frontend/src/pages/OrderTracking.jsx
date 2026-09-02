import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { CheckCircle2, Circle, Package, Truck, Home, ExternalLink, MapPin } from "lucide-react";

const STEPS = [
  { key: "PLACED", label: "Order Confirmed", icon: CheckCircle2 },
  { key: "PROCESSING", label: "Processing", icon: Package },
  { key: "PACKED", label: "Packed", icon: Package },
  { key: "SHIPPED", label: "Shipped", icon: Truck },
  { key: "IN_TRANSIT", label: "In Transit", icon: Truck },
  { key: "OUT_FOR_DELIVERY", label: "Out for Delivery", icon: Truck },
  { key: "DELIVERED", label: "Delivered", icon: Home },
];

export default function OrderTracking() {
  const { orderNumber } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    api.get(`/orders/${orderNumber}/tracking`)
       .then((r) => setData(r.data))
       .catch(() => setErr("We couldn't find this order. Please check the order number."));
  }, [orderNumber]);

  if (err) return <div className="container-nl py-24 text-center text-muted-foreground">{err}</div>;
  if (!data) return <div className="container-nl py-24 text-center text-muted-foreground">Loading…</div>;

  const currentIdx = STEPS.findIndex((s) => s.key === data.shipment_status);
  const activeIdx = currentIdx < 0 ? 0 : currentIdx;
  const latestEvent = (data.events && data.events.length > 0) ? data.events[data.events.length - 1] : null;
  const cancelled = data.internal_status === "CANCELLED" || data.internal_status === "REFUNDED";

  return (
    <section className="container-nl py-12 lg:py-16 max-w-4xl">
      <div className="overline text-secondary">NileNest Order</div>
      <h1 className="font-display text-4xl sm:text-5xl mt-2">#{data.order_number}</h1>
      <p className="text-muted-foreground mt-3">
        {cancelled ? (
          data.internal_status === "REFUNDED" ? "Your refund is being processed."
          : "Your order has been cancelled."
        ) : data.shipment_status === "DELIVERED" ? "Your order has been delivered — thank you."
          : data.shipment_status === "OUT_FOR_DELIVERY" ? "Out for delivery today."
          : data.shipment_status === "IN_TRANSIT" ? "Your NileNest order is on its way."
          : data.shipment_status === "SHIPPED" ? "Your order has been dispatched."
          : "We're preparing your order with care."}
      </p>

      {/* Timeline */}
      {!cancelled && (
      <div className="mt-10 relative" data-testid="tracking-timeline">
        <div className="hidden md:block absolute left-0 right-0 top-4 h-px bg-border" aria-hidden />
        <div className="hidden md:block absolute left-0 top-4 h-px bg-secondary transition-all duration-700"
             style={{ width: `${(activeIdx / (STEPS.length - 1)) * 100}%` }} aria-hidden />
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
          {STEPS.map((s, i) => {
            const Icon = i <= activeIdx ? CheckCircle2 : Circle;
            const active = i <= activeIdx;
            return (
              <div key={s.key} className="text-center relative">
                <div className={`w-8 h-8 rounded-full mx-auto flex items-center justify-center ${active ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground"} transition-colors`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className={`mt-2 text-[10px] tracking-wider uppercase leading-tight ${active ? "text-primary" : "text-muted-foreground"}`}>
                  {s.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      )}

      {/* Shipment info card */}
      <div className="grid md:grid-cols-2 gap-4 mt-10">
        <div className="bg-accent/40 rounded-md p-5">
          <div className="overline text-muted-foreground mb-2">Shipment</div>
          <dl className="text-sm space-y-1">
            {data.courier_name && (<><dt className="text-muted-foreground inline">Courier: </dt><dd className="inline font-medium">{data.courier_name}</dd><br/></>)}
            {data.awb && (<><dt className="text-muted-foreground inline">AWB / Tracking #: </dt><dd className="inline font-mono">{data.awb}</dd><br/></>)}
            {data.eta && (<><dt className="text-muted-foreground inline">Estimated delivery: </dt><dd className="inline font-medium">{data.eta}</dd><br/></>)}
            {data.last_tracking_at && (<><dt className="text-muted-foreground inline">Last update: </dt><dd className="inline">{new Date(data.last_tracking_at).toLocaleString()}</dd></>)}
            {!data.courier_name && !data.awb && (
              <p className="text-muted-foreground">Your order is being prepared. Tracking details will appear here once it's dispatched.</p>
            )}
          </dl>
          {data.tracking_url && (
            <a href={data.tracking_url} target="_blank" rel="noopener noreferrer"
               data-testid="view-courier-tracking"
               className="mt-4 inline-flex items-center gap-1 text-secondary text-xs link-underline">
              View courier tracking <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
        <div className="bg-accent/40 rounded-md p-5">
          <div className="overline text-muted-foreground mb-2">Delivering to</div>
          <div className="text-sm">
            {data.address?.city && data.address?.state && (
              <div className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-secondary" />{data.address.city}, {data.address.state} · {data.address.pincode}</div>
            )}
          </div>
        </div>
      </div>

      {/* Latest update banner */}
      {latestEvent && (
        <div className="mt-6 border-l-2 border-secondary bg-background pl-4 py-2">
          <div className="text-[10px] tracking-widest uppercase text-secondary">Latest update</div>
          <div className="text-sm mt-1 font-medium">{latestEvent.note || latestEvent.status.replace(/_/g, " ")}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {latestEvent.location && <>{latestEvent.location} · </>}
            {new Date(latestEvent.at).toLocaleString()}
          </div>
        </div>
      )}

      {/* Full event log (only real events, never fabricated) */}
      {data.events && data.events.length > 0 && (
        <div className="mt-10">
          <div className="overline text-secondary mb-3">Tracking history</div>
          <div className="border border-border rounded-md divide-y">
            {[...data.events].reverse().map((ev, i) => (
              <div key={i} className="p-4 flex justify-between gap-4 text-sm">
                <div>
                  <div className="font-medium">{ev.status.replace(/_/g, " ")}</div>
                  {ev.note && <div className="text-xs text-muted-foreground mt-0.5">{ev.note}</div>}
                  {ev.location && <div className="text-xs text-muted-foreground">{ev.location}</div>}
                </div>
                <div className="text-xs text-muted-foreground text-right whitespace-nowrap">{new Date(ev.at).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Internal admin timeline (dedup — only show if no courier events yet) */}
      {(!data.events || data.events.length === 0) && data.order_timeline && data.order_timeline.length > 0 && (
        <div className="mt-10">
          <div className="overline text-muted-foreground mb-3">Internal status</div>
          <div className="border border-border rounded-md divide-y">
            {data.order_timeline.map((t, i) => (
              <div key={i} className="p-4 flex justify-between text-sm">
                <div><div className="font-medium">{t.status}</div><div className="text-xs text-muted-foreground">{t.note}</div></div>
                <div className="text-xs text-muted-foreground">{new Date(t.at).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-10">
        <Link to="/shop" className="btn-ghost">Continue shopping</Link>
      </div>
    </section>
  );
}
