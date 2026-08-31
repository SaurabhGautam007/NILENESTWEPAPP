import React from "react";
import { Link } from "react-router-dom";
import { MapPin, Leaf, Award } from "lucide-react";

export default function Transparency() {
  return (
    <>
      <section className="container-nl py-16 max-w-3xl">
        <div className="overline text-secondary">Transparency</div>
        <h1 className="font-display text-5xl mt-3">Certifications are floors, not ceilings.</h1>
        <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
          A certification tells you what isn't there. Traceability tells you what is — a named farm, a harvest date, and a small-batch roast.
          On this page, we publish everything we know about every SKU we sell.
        </p>
      </section>

      <section className="bg-accent/40 py-16">
        <div className="container-nl grid md:grid-cols-3 gap-10">
          {[
            { icon: MapPin, title: "Named origins", body: "Every ingredient is traceable to a specific farm and grower. No blended commodity supply." },
            { icon: Leaf, title: "Small batches", body: "Tea batches under 40kg. Makhana batches under 20kg. Slower, but fresher." },
            { icon: Award, title: "Independent testing", body: "Every batch is heavy-metal, pesticide and microbial tested before release. Reports on request." },
          ].map((c, i) => (
            <div key={i}>
              <c.icon className="w-8 h-8 text-secondary" />
              <h3 className="font-display text-2xl mt-4">{c.title}</h3>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container-nl py-16 max-w-3xl text-center">
        <h2 className="font-display text-4xl">Read our sourcing notes on the Journal.</h2>
        <Link to="/journal" className="btn-primary mt-8 inline-flex">Go to Journal</Link>
      </section>
    </>
  );
}
