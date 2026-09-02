import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { api, money } from "@/lib/api";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TID } from "@/constants/testIds";
import { toast } from "sonner";

export default function Admin() {
  const { user, loading, logout } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) nav("/login");
    else if (user.role !== "admin" && user.role !== "editor") nav("/account");
  }, [user, loading, nav]);

  if (!user || (user.role !== "admin" && user.role !== "editor")) return null;

  return (
    <section className="container-nl py-10">
      <div className="flex flex-wrap justify-between items-end gap-4 mb-8">
        <div>
          <div className="overline text-secondary">{user.role.toUpperCase()}</div>
          <h1 className="font-display text-4xl mt-2">NileNest Admin</h1>
        </div>
        <button onClick={() => { logout(); nav("/"); }} className="btn-ghost">Sign out</button>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList className="mb-8 flex-wrap h-auto">
          <TabsTrigger data-testid={TID.admin.dashTab} value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger data-testid={TID.admin.ordersTab} value="orders">Orders</TabsTrigger>
          <TabsTrigger data-testid={TID.admin.catalogTab} value="catalog">Catalog</TabsTrigger>
          <TabsTrigger data-testid={TID.admin.promotionsTab} value="promotions">Promotions</TabsTrigger>
          <TabsTrigger data-testid={TID.admin.journalTab} value="journal">Journal</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger data-testid={TID.admin.auditTab} value="audit">Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard"><Dashboard /></TabsContent>
        <TabsContent value="orders"><Orders /></TabsContent>
        <TabsContent value="catalog"><Catalog /></TabsContent>
        <TabsContent value="promotions"><Promotions /></TabsContent>
        <TabsContent value="journal"><JournalAdmin /></TabsContent>
        <TabsContent value="customers"><Customers /></TabsContent>
        <TabsContent value="audit"><Audit /></TabsContent>
      </Tabs>
    </section>
  );
}

function Dashboard() {
  const [stats, setStats] = useState(null);
  useEffect(() => { api.get("/admin/stats").then((r) => setStats(r.data)); }, []);
  if (!stats) return <div>Loading…</div>;
  const cards = [
    { label: "Orders today", value: stats.orders_today },
    { label: "Total orders", value: stats.total_orders },
    { label: "Revenue today", value: money(stats.revenue_today) },
    { label: "Lifetime revenue", value: money(stats.revenue) },
    { label: "Products", value: stats.product_count },
    { label: "Customers", value: stats.customer_count },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="bg-accent/40 rounded-md p-6">
          <div className="overline text-muted-foreground">{c.label}</div>
          <div className="font-display text-4xl mt-2">{c.value}</div>
        </div>
      ))}
      <div className="col-span-2 md:col-span-3 bg-accent/40 rounded-md p-6">
        <div className="overline text-secondary mb-3">Low stock</div>
        {stats.low_stock.length === 0 ? <p className="text-sm text-muted-foreground">All variants healthy.</p> :
          <ul className="text-sm space-y-1">
            {stats.low_stock.map((s, i) => <li key={i} className="flex justify-between"><span>{s.product} — {s.variant}</span><span className="text-secondary">{s.stock} left</span></li>)}
          </ul>
        }
      </div>
    </div>
  );
}

function Orders() {
  const [orders, setOrders] = useState([]);
  const [providers, setProviders] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ courier_slug: "manual", courier_name: "", awb: "", tracking_url: "", eta: "", shipment_status: "" });
  const [event, setEvent] = useState({ status: "", note: "", location: "" });
  const load = () => api.get("/admin/orders").then((r) => setOrders(r.data));
  useEffect(() => { load(); api.get("/shipping/providers").then((r) => setProviders(r.data)); }, []);
  const update = async (id, status) => {
    await api.patch(`/admin/orders/${id}`, { status, tracking_id: status === "SHIPPED" ? `TRK${Date.now().toString().slice(-8)}` : null });
    toast.success(`Marked ${status}`); load();
  };
  const openEdit = (o) => {
    setEditing(o.id);
    setForm({
      courier_slug: o.courier_slug || "manual",
      courier_name: o.courier_name || "",
      awb: o.awb || o.tracking_id || "",
      tracking_url: o.tracking_url || "",
      eta: o.eta || "",
      shipment_status: o.shipment_status || "",
    });
    setEvent({ status: "", note: "", location: "" });
  };
  const saveShipment = async () => {
    await api.patch(`/admin/orders/${editing}/shipment`, form);
    toast.success("Shipment updated"); setEditing(null); load();
  };
  const addEvent = async () => {
    if (!event.status) return toast.error("Status required");
    await api.post(`/admin/orders/${editing}/tracking-event`, event);
    toast.success("Event added"); setEvent({ status: "", note: "", location: "" }); load();
  };
  const next = { PLACED: "PACKED", PACKED: "SHIPPED", SHIPPED: "DELIVERED" };
  return (
    <div className="space-y-3">
      {orders.map((o) => (
        <div key={o.id} className="border border-border rounded-md p-4">
          <div className="flex flex-wrap gap-4 justify-between items-center">
            <div>
              <div className="font-medium">{o.order_number}</div>
              <div className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()} · {o.email}</div>
              {(o.courier_name || o.awb) && (
                <div className="text-xs text-muted-foreground mt-1">
                  {o.courier_name && <>Courier: <b>{o.courier_name}</b> · </>}
                  {o.awb && <>AWB: <span className="font-mono">{o.awb}</span></>}
                  {o.shipment_status && <> · Shipment: <b>{o.shipment_status}</b></>}
                </div>
              )}
            </div>
            <div className="text-sm">{money(o.total)}</div>
            <div className="text-xs">
              <div className="overline text-secondary">Internal: {o.status}</div>
              {o.shipment_status && o.shipment_status !== o.status && <div className="text-muted-foreground">Courier: {o.shipment_status}</div>}
            </div>
            <div className="flex gap-2">
              {next[o.status] && <button onClick={() => update(o.id, next[o.status])} className="text-xs link-underline">→ {next[o.status]}</button>}
              {o.status !== "CANCELLED" && o.status !== "DELIVERED" && <button onClick={() => update(o.id, "CANCELLED")} className="text-xs text-destructive link-underline">Cancel</button>}
              <button onClick={() => openEdit(o)} className="text-xs link-underline text-secondary">Shipment</button>
            </div>
          </div>
          {editing === o.id && (
            <div className="mt-4 pt-4 border-t border-border/40 grid md:grid-cols-2 gap-4">
              <div>
                <div className="overline text-secondary mb-2">Shipment details</div>
                <div className="space-y-2 text-sm">
                  <select value={form.courier_slug} onChange={(e) => setForm({...form, courier_slug: e.target.value})} className="w-full border border-border rounded-md p-2 bg-transparent text-sm">
                    {providers.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
                  </select>
                  <input value={form.courier_name} onChange={(e) => setForm({...form, courier_name: e.target.value})} placeholder="Courier display name (e.g. Delhivery)" className="w-full border border-border rounded-md p-2 bg-transparent text-sm" />
                  <input value={form.awb} onChange={(e) => setForm({...form, awb: e.target.value})} placeholder="AWB / Tracking number" className="w-full border border-border rounded-md p-2 bg-transparent text-sm" />
                  <input value={form.tracking_url} onChange={(e) => setForm({...form, tracking_url: e.target.value})} placeholder="Public tracking URL (optional)" className="w-full border border-border rounded-md p-2 bg-transparent text-sm" />
                  <input value={form.eta} onChange={(e) => setForm({...form, eta: e.target.value})} placeholder="ETA (e.g. 12 Feb 2026)" className="w-full border border-border rounded-md p-2 bg-transparent text-sm" />
                  <select value={form.shipment_status} onChange={(e) => setForm({...form, shipment_status: e.target.value})} className="w-full border border-border rounded-md p-2 bg-transparent text-sm">
                    <option value="">— Shipment status —</option>
                    {["PACKED","SHIPPED","IN_TRANSIT","OUT_FOR_DELIVERY","DELIVERED"].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button onClick={saveShipment} className="btn-primary text-xs">Save shipment</button>
                </div>
              </div>
              <div>
                <div className="overline text-secondary mb-2">Add tracking event</div>
                <div className="space-y-2 text-sm">
                  <select value={event.status} onChange={(e) => setEvent({...event, status: e.target.value})} className="w-full border border-border rounded-md p-2 bg-transparent text-sm">
                    <option value="">— Select status —</option>
                    {["PACKED","SHIPPED","IN_TRANSIT","OUT_FOR_DELIVERY","DELIVERED"].map((s) => <option key={s} value={s}>{s.replace(/_/g," ")}</option>)}
                  </select>
                  <input value={event.location} onChange={(e) => setEvent({...event, location: e.target.value})} placeholder="Location (e.g. Pune hub)" className="w-full border border-border rounded-md p-2 bg-transparent text-sm" />
                  <input value={event.note} onChange={(e) => setEvent({...event, note: e.target.value})} placeholder="Note (e.g. Reached Pune delivery hub)" className="w-full border border-border rounded-md p-2 bg-transparent text-sm" />
                  <button onClick={addEvent} className="btn-ghost text-xs">Append event</button>
                </div>
              </div>
              <div className="md:col-span-2 text-right">
                <button onClick={() => setEditing(null)} className="text-xs link-underline text-muted-foreground">Close</button>
              </div>
            </div>
          )}
        </div>
      ))}
      {orders.length === 0 && <p className="text-sm text-muted-foreground">No orders yet.</p>}
    </div>
  );
}

function Catalog() {
  const [products, setProducts] = useState([]);
  const load = () => api.get("/products").then((r) => setProducts(r.data));
  useEffect(() => { load(); }, []);
  const setStock = async (product, variant_id, stock) => {
    const variants = product.variants.map((v) => v.id === variant_id ? { ...v, stock: parseInt(stock) || 0 } : v);
    await api.patch(`/admin/products/${product.id}`, { variants });
    toast.success("Stock updated"); load();
  };
  const uploadImage = async (product, file) => {
    const fd = new FormData(); fd.append("file", file);
    try {
      const { data } = await api.post("/admin/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      const backend = process.env.REACT_APP_BACKEND_URL;
      const url = `${backend}${data.url}`;
      const images = [...(product.images || []), url];
      await api.patch(`/admin/products/${product.id}`, { images });
      toast.success("Image uploaded"); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Upload failed"); }
  };
  const removeImage = async (product, url) => {
    const images = (product.images || []).filter((u) => u !== url);
    await api.patch(`/admin/products/${product.id}`, { images });
    load();
  };
  return (
    <div className="space-y-6">
      {products.map((p) => (
        <div key={p.id} className="border border-border rounded-md p-4">
          <div className="flex gap-4">
            <img src={p.images[0]} alt="" className="w-20 h-20 object-cover rounded-md" />
            <div className="flex-1">
              <div className="font-display text-2xl">{p.title}</div>
              <div className="text-xs text-muted-foreground">{p.slug}</div>
              <div className="mt-3 space-y-2">
                {p.variants.map((v) => (
                  <div key={v.id} className="flex flex-wrap gap-3 items-center text-sm">
                    <div className="w-32">{v.name}</div>
                    <div className="text-muted-foreground">SKU: {v.sku}</div>
                    <div>{money(v.price)}</div>
                    <input type="number" defaultValue={v.stock} onBlur={(e) => setStock(p, v.id, e.target.value)}
                           className="w-20 border border-border rounded-md p-1 text-sm bg-transparent" />
                    <span className={`text-xs ${v.stock_state === "OUT_OF_STOCK" ? "text-destructive" : v.stock_state === "LOW_STOCK" ? "text-secondary" : "text-muted-foreground"}`}>{v.stock_state}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-border/40">
                <div className="overline text-secondary mb-2">Images</div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {(p.images || []).map((u) => (
                    <div key={u} className="relative group">
                      <img src={u} alt="" className="w-16 h-16 object-cover rounded-md" />
                      <button onClick={() => removeImage(p, u)} className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-xs opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                    </div>
                  ))}
                </div>
                <label className="btn-ghost text-xs cursor-pointer inline-flex" data-testid={`upload-image-${p.slug}`}>
                  Upload image
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadImage(p, e.target.files[0])} />
                </label>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Promotions() {
  const [coupons, setCoupons] = useState([]);
  const [form, setForm] = useState({ code: "", type: "PERCENT", value: 10, min_subtotal: 0, active: true });
  const load = () => api.get("/admin/coupons").then((r) => setCoupons(r.data));
  useEffect(() => { load(); }, []);
  const create = async () => {
    if (!form.code) return toast.error("Code required");
    await api.post("/admin/coupons", form);
    toast.success("Coupon created"); setForm({ ...form, code: "" }); load();
  };
  const del = async (id) => { await api.delete(`/admin/coupons/${id}`); load(); };
  return (
    <div>
      <div className="border border-border rounded-md p-4 mb-6">
        <div className="overline text-secondary mb-3">New coupon</div>
        <div className="grid sm:grid-cols-4 gap-3">
          <input value={form.code} onChange={(e) => setForm({...form, code: e.target.value.toUpperCase()})} placeholder="CODE" className="border border-border rounded-md p-2 bg-transparent text-sm" />
          <select value={form.type} onChange={(e) => setForm({...form, type: e.target.value})} className="border border-border rounded-md p-2 bg-transparent text-sm">
            <option value="PERCENT">Percent</option><option value="FLAT">Flat</option>
            <option value="FREE_SHIPPING">Free shipping</option><option value="FIRST_ORDER">First order</option>
          </select>
          <input type="number" value={form.value} onChange={(e) => setForm({...form, value: parseFloat(e.target.value) || 0})} placeholder="Value" className="border border-border rounded-md p-2 bg-transparent text-sm" />
          <button onClick={create} className="btn-primary">Create</button>
        </div>
      </div>
      <div className="space-y-2">
        {coupons.map((c) => (
          <div key={c.id} className="flex justify-between items-center border border-border rounded-md p-3 text-sm">
            <div><span className="font-medium">{c.code}</span> · {c.type} · {c.value}</div>
            <button onClick={() => del(c.id)} className="text-xs text-destructive link-underline">Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function JournalAdmin() {
  const [articles, setArticles] = useState([]);
  const [form, setForm] = useState({ slug: "", title: "", excerpt: "", body_html: "", hero_image: "", tags: "" });
  const load = () => api.get("/articles").then((r) => setArticles(r.data));
  useEffect(() => { load(); }, []);
  const create = async () => {
    if (!form.slug || !form.title) return toast.error("Slug and title required");
    await api.post("/admin/articles", { ...form, tags: form.tags.split(",").map((s) => s.trim()).filter(Boolean) });
    toast.success("Article created"); setForm({ slug: "", title: "", excerpt: "", body_html: "", hero_image: "", tags: "" }); load();
  };
  const del = async (id) => { await api.delete(`/admin/articles/${id}`); load(); };
  return (
    <div>
      <div className="border border-border rounded-md p-4 mb-6 space-y-3">
        <div className="overline text-secondary">New article</div>
        <div className="grid sm:grid-cols-2 gap-3">
          <input value={form.slug} onChange={(e) => setForm({...form, slug: e.target.value})} placeholder="slug" className="border border-border rounded-md p-2 bg-transparent text-sm" />
          <input value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} placeholder="Title" className="border border-border rounded-md p-2 bg-transparent text-sm" />
        </div>
        <input value={form.hero_image} onChange={(e) => setForm({...form, hero_image: e.target.value})} placeholder="Hero image URL" className="w-full border border-border rounded-md p-2 bg-transparent text-sm" />
        <input value={form.excerpt} onChange={(e) => setForm({...form, excerpt: e.target.value})} placeholder="Excerpt" className="w-full border border-border rounded-md p-2 bg-transparent text-sm" />
        <textarea rows={4} value={form.body_html} onChange={(e) => setForm({...form, body_html: e.target.value})} placeholder="Body HTML" className="w-full border border-border rounded-md p-2 bg-transparent text-sm" />
        <input value={form.tags} onChange={(e) => setForm({...form, tags: e.target.value})} placeholder="tags,comma,separated" className="w-full border border-border rounded-md p-2 bg-transparent text-sm" />
        <button onClick={create} className="btn-primary">Publish</button>
      </div>
      <div className="space-y-2">
        {articles.map((a) => (
          <div key={a.id} className="flex justify-between items-center border border-border rounded-md p-3 text-sm">
            <div><span className="font-medium">{a.title}</span> <span className="text-muted-foreground">· {a.slug}</span></div>
            <button onClick={() => del(a.id)} className="text-xs text-destructive link-underline">Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Customers() {
  const [customers, setCustomers] = useState([]);
  useEffect(() => { api.get("/admin/customers").then((r) => setCustomers(r.data)); }, []);
  return (
    <div className="space-y-2">
      {customers.map((c) => (
        <div key={c.id} className="border border-border rounded-md p-3 text-sm flex justify-between">
          <div><div className="font-medium">{c.name}</div><div className="text-xs text-muted-foreground">{c.email}</div></div>
          <div className="text-xs text-muted-foreground">Joined {new Date(c.created_at).toLocaleDateString()}</div>
        </div>
      ))}
      {customers.length === 0 && <p className="text-sm text-muted-foreground">No customers yet.</p>}
    </div>
  );
}

function Audit() {
  const [log, setLog] = useState([]);
  useEffect(() => { api.get("/admin/audit-log").then((r) => setLog(r.data)); }, []);
  return (
    <div className="border border-border rounded-md divide-y">
      {log.map((l) => (
        <div key={l.id} className="p-3 text-sm flex flex-wrap gap-4 justify-between">
          <div><span className="overline text-secondary">{l.action}</span> <span className="text-muted-foreground ml-2">{l.target}</span></div>
          <div className="text-xs text-muted-foreground">{new Date(l.at).toLocaleString()}</div>
        </div>
      ))}
      {log.length === 0 && <p className="p-3 text-sm text-muted-foreground">No audit events yet.</p>}
    </div>
  );
}
