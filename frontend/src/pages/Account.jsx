import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { api, money } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import { TID } from "@/constants/testIds";
import { toast } from "sonner";

function TrackForm() {
  const [num, setNum] = useState("");
  const nav = useNavigate();
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (num.trim()) nav(`/track/${num.trim()}`); }} className="flex gap-2">
      <input value={num} onChange={(e) => setNum(e.target.value)} placeholder="e.g. NN26XXXXXX"
             data-testid="track-order-input"
             className="flex-1 border border-border rounded-md p-2 text-sm bg-background focus:outline-none focus:border-secondary" />
      <button type="submit" data-testid="track-order-submit" className="btn-secondary text-xs px-4 py-2">Track</button>
    </form>
  );
}

export default function Account() {
  const { user, loading, logout } = useAuth();
  const { add } = useCart();
  const nav = useNavigate();
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    if (!loading && !user) nav("/login");
    else if (user) api.get("/orders").then((r) => setOrders(r.data));
  }, [user, loading, nav]);

  if (!user) return null;

  const reorder = async (order) => {
    for (const item of order.items) {
      await add(item.product_id, item.variant_id, item.quantity);
    }
    toast.success("Items added to basket");
  };

  return (
    <section className="container-nl py-16">
      <div className="flex flex-wrap justify-between items-end gap-4 mb-10">
        <div>
          <div className="overline text-secondary">Account</div>
          <h1 className="font-display text-5xl mt-3">Hello, {user.name.split(" ")[0]}.</h1>
        </div>
        <button data-testid={TID.header.logoutBtn} onClick={() => { logout(); nav("/"); }} className="btn-ghost">Sign out</button>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="bg-accent/40 p-6 rounded-md">
          <div className="overline text-muted-foreground mb-3">Profile</div>
          <div className="text-sm space-y-1">
            <div className="font-medium">{user.name}</div>
            <div className="text-muted-foreground">{user.email}</div>
          </div>
          <div className="mt-6 pt-6 border-t border-border/60">
            <div className="overline text-secondary mb-2">Track an order</div>
            <p className="text-xs text-muted-foreground mb-3">Enter your order number to see its progress.</p>
            <TrackForm />
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="overline text-secondary mb-4">My Orders ({orders.length})</div>
          {orders.length === 0 && <p className="text-muted-foreground text-sm">No orders yet — <Link to="/shop" className="link-underline">start with something considered</Link>.</p>}
          <div className="space-y-3">
            {orders.map((o) => (
              <div key={o.id} className="border border-border rounded-md p-4 flex flex-wrap gap-4 justify-between items-center">
                <div>
                  <div className="font-medium">{o.order_number}</div>
                  <div className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()} · {o.items.length} items</div>
                </div>
                <div className="text-sm">{money(o.total)}</div>
                <div className="overline text-secondary">{o.status}</div>
                <div className="flex gap-2">
                  <Link to={`/track/${o.order_number}`} className="text-xs link-underline">Track</Link>
                  <button onClick={() => reorder(o)} className="text-xs link-underline text-secondary">Reorder</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
