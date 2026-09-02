import React from "react";
import { Link } from "react-router-dom";
import { Leaf, Users, Sprout, Heart } from "lucide-react";

export default function About() {
  return (
    <>
      <section className="container-nl py-16 max-w-3xl">
        <div className="overline text-secondary">About NileNest</div>
        <h1 className="font-display text-5xl sm:text-6xl mt-3 leading-[1.05]">A family, not a factory.</h1>
        <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
          NileNest began between two kitchens — one in a Himalayan farmhouse, one in a Mumbai
          food-science lab. Every product we make is co-developed with the grower whose name
          appears on our transparency panel, tested independently, and packed in small batches
          so it reaches you the way it left the farm.
        </p>
      </section>

      <section className="bg-accent/40 py-16">
        <div className="container-nl grid md:grid-cols-4 gap-8">
          {[
            { icon: Sprout, title: "Farmer-traceable", body: "Every ingredient is traceable to a named farm and harvest date." },
            { icon: Leaf, title: "Small-batch", body: "Tea under 40kg per batch, makhana under 20kg. Slower, but fresher." },
            { icon: Heart, title: "Fair harvest", body: "We pay fair harvest wages to the women farmers in our supply chain." },
            { icon: Users, title: "Family-run", body: "Two co-founders, four employees, hundreds of families we serve." },
          ].map((v, i) => (
            <div key={i}>
              <v.icon className="w-8 h-8 text-secondary" />
              <h3 className="font-display text-xl mt-3">{v.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{v.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container-nl py-16 max-w-3xl">
        <div className="overline text-secondary">What we believe</div>
        <h2 className="font-display text-4xl mt-3">Wellness should feel personal.</h2>
        <p className="mt-4 text-muted-foreground leading-relaxed">
          The way a family member asks, "Are you eating properly?" or "How are you feeling today?"
          — we want NileNest to bring that same feeling of care into everyday wellness. Not a
          faceless brand, not a hyped supplement, not a hype cycle. Just quiet, honest food.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/shop" className="btn-primary">Explore the shop</Link>
          <Link to="/transparency" className="btn-ghost">Read our sourcing notes</Link>
        </div>
      </section>
    </>
  );
}
