import React from "react";
import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <section className="container-nl py-32 text-center">
      <div className="overline text-secondary">404</div>
      <h1 className="font-display text-6xl mt-3">Nothing here.</h1>
      <p className="mt-4 text-muted-foreground">The page you're looking for has drifted off. Return to the garden.</p>
      <Link to="/" className="btn-primary mt-10 inline-flex">Take me home</Link>
    </section>
  );
}
