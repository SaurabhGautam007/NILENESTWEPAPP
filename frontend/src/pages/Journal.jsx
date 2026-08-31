import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";

export default function Journal() {
  const [articles, setArticles] = useState([]);
  useEffect(() => { api.get("/articles").then((r) => setArticles(r.data)); }, []);
  return (
    <section className="container-nl py-16">
      <div className="max-w-2xl">
        <div className="overline text-secondary">Journal</div>
        <h1 className="font-display text-5xl mt-3">Notes on slower living.</h1>
        <p className="mt-4 text-muted-foreground leading-relaxed">Editorial from the NileNest kitchen, farms, and testing bench.</p>
      </div>
      <div className="mt-16 grid md:grid-cols-3 gap-10">
        {articles.map((a) => (
          <Link to={`/journal/${a.slug}`} key={a.id} className="group">
            <div className="aspect-[4/3] overflow-hidden rounded-md mb-4">
              <img src={a.hero_image} alt={a.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
            </div>
            <div className="overline text-secondary">{a.tags?.[0]}</div>
            <h2 className="font-display text-2xl mt-2 group-hover:text-secondary transition-colors">{a.title}</h2>
            <p className="text-sm text-muted-foreground mt-2">{a.excerpt}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
