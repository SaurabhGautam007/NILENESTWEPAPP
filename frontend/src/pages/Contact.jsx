import React, { useState } from "react";
import { toast } from "sonner";

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const submit = (e) => {
    e.preventDefault();
    toast.success("Thank you — we'll get back to you within 24 hours.");
    setForm({ name: "", email: "", message: "" });
  };
  return (
    <section className="container-nl py-16 max-w-2xl">
      <div className="overline text-secondary">Contact</div>
      <h1 className="font-display text-5xl mt-3">Say hello.</h1>
      <p className="mt-4 text-muted-foreground">care@nilenest.in · Response within 24 hours.</p>
      <form onSubmit={submit} className="mt-10 space-y-4">
        <input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} placeholder="Name" required className="w-full border border-border rounded-md p-3 bg-transparent text-sm" />
        <input value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} placeholder="Email" type="email" required className="w-full border border-border rounded-md p-3 bg-transparent text-sm" />
        <textarea value={form.message} onChange={(e) => setForm({...form, message: e.target.value})} placeholder="Message" rows={5} required className="w-full border border-border rounded-md p-3 bg-transparent text-sm" />
        <button type="submit" className="btn-primary">Send message</button>
      </form>
    </section>
  );
}
