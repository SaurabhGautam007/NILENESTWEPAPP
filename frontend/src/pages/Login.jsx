import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { TID } from "@/constants/testIds";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const u = await login(email, password);
      toast.success("Welcome back.");
      nav(u.role === "admin" || u.role === "editor" ? "/admin" : "/account");
    } catch (err) { toast.error(err.response?.data?.detail || "Invalid credentials"); }
    finally { setBusy(false); }
  };
  return (
    <section className="container-nl py-20 max-w-md">
      <div className="overline text-secondary">Sign in</div>
      <h1 className="font-display text-4xl mt-3">Welcome back.</h1>
      <form onSubmit={submit} className="mt-10 space-y-4">
        <input data-testid={TID.auth.email} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required className="w-full border border-border rounded-md p-3 bg-transparent text-sm" />
        <input data-testid={TID.auth.password} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required className="w-full border border-border rounded-md p-3 bg-transparent text-sm" />
        <button data-testid={TID.auth.submit} disabled={busy} type="submit" className="btn-primary w-full">{busy ? "…" : "Sign in"}</button>
      </form>
      <p className="mt-6 text-sm text-muted-foreground">New here? <Link to="/register" className="link-underline text-primary">Create an account</Link></p>
    </section>
  );
}
