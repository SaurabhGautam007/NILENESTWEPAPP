import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import ProductCard from "@/components/ProductCard";

export default function Article() {
  const { slug } = useParams();
  const [a, setA] = useState(null);
  useEffect(() => { api.get(`/articles/${slug}`).then((r) => setA(r.data)); }, [slug]);
  if (!a) return <div className="container-nl py-24 text-center text-muted-foreground">Loading…</div>;
  return (
    <>
      <section className="container-nl py-12 max-w-3xl">
        <Link to="/journal" className="text-xs tracking-widest uppercase text-muted-foreground hover:text-secondary">← Journal</Link>
        <div className="overline text-secondary mt-6">{a.tags?.[0]}</div>
        <h1 className="font-display text-4xl sm:text-5xl mt-3 leading-tight">{a.title}</h1>
        <p className="mt-4 text-muted-foreground">By {a.author} · {new Date(a.published_at).toLocaleDateString()}</p>
      </section>
      <div className="container-nl max-w-4xl">
        <div className="aspect-[16/9] rounded-md overflow-hidden mb-10">
          <img src={a.hero_image} alt={a.title} className="w-full h-full object-cover" />
        </div>
      </div>
      <article className="container-nl max-w-2xl prose-nl pb-16" dangerouslySetInnerHTML={{ __html: a.body_html }} />
      {a.related_products?.length > 0 && (
        <section className="container-nl py-16 border-t border-border/60">
          <div className="overline text-secondary">Featured in this piece</div>
          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-6">
            {a.related_products.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}
    </>
  );
}
