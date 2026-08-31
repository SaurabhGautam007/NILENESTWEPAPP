import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { TID } from "@/constants/testIds";

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      await register(form.email, form.password, form.name);
      toast.success("Welcome to NileNest.");
      nav("/account");
    } catch (err) { toast.error(err.response?.data?.detail || "Registration failed"); }
    finally { setBusy(false); }
  };
  return (
    <section className="container-nl py-20 max-w-md">
      <div className="overline text-secondary">Create account</div>
      <h1 className="font-display text-4xl mt-3">Join NileNest.</h1>
      <form onSubmit={submit} className="mt-10 space-y-4">
        <input data-testid={TID.auth.name} value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} placeholder="Full name" required className="w-full border border-border rounded-md p-3 bg-transparent text-sm" />
        <input data-testid={TID.auth.email} type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} placeholder="Email" required className="w-full border border-border rounded-md p-3 bg-transparent text-sm" />
        <input data-testid={TID.auth.password} type="password" value={form.password} onChange={(e) => setForm({...form, password: e.target.value})} placeholder="Password (min 6 chars)" required minLength={6} className="w-full border border-border rounded-md p-3 bg-transparent text-sm" />
        <button data-testid={TID.auth.submit} disabled={busy} type="submit" className="btn-primary w-full">{busy ? "…" : "Create account"}</button>
      </form>
      <p className="mt-6 text-sm text-muted-foreground">Already have one? <Link to="/login" className="link-underline text-primary">Sign in</Link></p>
    </section>
  );
}
