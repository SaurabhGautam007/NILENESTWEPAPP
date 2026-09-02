import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import ProductCard from "@/components/ProductCard";
import { TID } from "@/constants/testIds";
import { ArrowRight, Sparkles } from "lucide-react";

export default function Home() {
  const [cms, setCms] = useState(null);
  const [products, setProducts] = useState([]);
  const [articles, setArticles] = useState([]);
  const [goal, setGoal] = useState("");
  const [recs, setRecs] = useState(null);
  const [recLoading, setRecLoading] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    api.get("/cms/homepage").then((r) => setCms(r.data.data));
    api.get("/products", { params: { featured: true } }).then((r) => setProducts(r.data));
    api.get("/articles").then((r) => setArticles(r.data.slice(0, 3)));
  }, []);

  const askRec = async () => {
    setRecLoading(true);
    try {
      const { data } = await api.post("/ai/recommend", { goal: goal || "help me pick a starter ritual" });
      setRecs(data);
    } finally { setRecLoading(false); }
  };

  const hero = cms || {};

  return (
    <>
      {/* HERO */}
      <section data-testid={TID.home.hero} className="relative overflow-hidden">
        <div className="container-nl pt-12 md:pt-20 lg:pt-24 pb-16 grid lg:grid-cols-12 gap-10 items-end">
          <div className="lg:col-span-6 z-10">
            <div className="overline text-secondary animate-fade-up">{hero.hero_overline || "New from NileNest"}</div>
            <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl leading-[0.95] mt-4 tracking-tight animate-fade-up" style={{animationDelay: "80ms"}}>
              {hero.hero_headline || "Nature, unhurried."}
            </h1>
            <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground animate-fade-up" style={{animationDelay: "160ms"}}>
              {hero.hero_sub}
            </p>
            <div className="mt-10 flex gap-3 animate-fade-up" style={{animationDelay: "240ms"}}>
              <Link to="/shop" data-testid={TID.home.heroCta} className="btn-primary">
                {hero.hero_cta || "Explore the shop"} <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
              <Link to="/transparency" className="btn-ghost">Our sourcing</Link>
            </div>
          </div>
          <div className="lg:col-span-6 relative">
            <div className="relative aspect-[4/5] lg:aspect-[4/5.5] overflow-hidden rounded-md">
              <img src={hero.hero_image || "https://images.unsplash.com/photo-1749137598868-94bde1951944?crop=entropy&cs=srgb&fm=jpg&q=85"} alt="Forest" className="w-full h-full object-cover" />
            </div>
            <div className="absolute -bottom-6 -left-6 hidden lg:block w-40 h-40 bg-secondary/90 text-secondary-foreground p-6 rounded-md">
              <div className="text-xs tracking-widest uppercase opacity-80">Est.</div>
              <div className="font-display text-4xl mt-1">2026</div>
              <div className="text-xs mt-2 leading-tight opacity-90">India-first premium wellness FMCG</div>
            </div>
          </div>
        </div>
        {/* Trust strip */}
        {hero.trust_strip?.length > 0 && (
          <div className="border-y border-border/60 bg-accent/30">
            <div className="container-nl py-4 flex flex-wrap justify-around gap-4 text-xs sm:text-sm text-muted-foreground">
              {hero.trust_strip.map((t, i) => <span key={i} className="tracking-wide">— {t} —</span>)}
            </div>
          </div>
        )}
      </section>

      {/* Featured */}
      <section className="section-pad">
        <div className="container-nl">
          <div className="flex flex-wrap items-end justify-between mb-10 gap-4">
            <div>
              <div className="overline text-secondary">The Collection</div>
              <h2 className="font-display text-4xl sm:text-5xl mt-2">Considered essentials.</h2>
            </div>
            <Link to="/shop" className="text-sm text-primary link-underline flex items-center gap-1">Shop all <ArrowRight className="w-4 h-4" /></Link>
          </div>
          <div data-testid={TID.home.featuredGrid} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
            {products.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </div>
      </section>

      {/* AI recommender */}
      <section className="section-pad bg-primary text-primary-foreground">
        <div className="container-nl grid lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-5">
            <div className="overline text-secondary">Concierge</div>
            <h2 className="font-display text-4xl sm:text-5xl mt-3">Tell us the moment. We'll suggest the ritual.</h2>
            <p className="mt-4 text-primary-foreground/70 max-w-md">Slow mornings, afternoon slumps, restless evenings. Share your moment and we'll suggest something from our collection — never a medical suggestion, always a considered one.</p>
          </div>
          <div className="lg:col-span-7">
            <div className="bg-background text-foreground rounded-md p-6">
              <label className="text-xs tracking-widest uppercase text-muted-foreground">Your moment</label>
              <textarea value={goal} onChange={(e) => setGoal(e.target.value)}
                placeholder="e.g. I want something calming after work…"
                className="mt-2 w-full min-h-[80px] bg-transparent border border-border rounded-md p-3 text-sm resize-none focus:outline-none focus:border-secondary" />
              <button data-testid={TID.home.aiRecommendBtn} onClick={askRec} disabled={recLoading}
                className="mt-4 btn-secondary">
                <Sparkles className="w-4 h-4 mr-2" /> {recLoading ? "Thinking…" : "Suggest something"}
              </button>
              {recs && (
                <div data-testid={TID.home.aiRecommendResult} className="mt-6 pt-6 border-t border-border">
                  <p className="text-sm italic text-muted-foreground">{recs.message}</p>
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    {recs.recommendations?.map((p) => <ProductCard key={p.id} product={p} />)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Journal preview */}
      <section className="section-pad">
        <div className="container-nl">
          <div className="flex items-end justify-between mb-10">
            <div>
              <div className="overline text-secondary">Journal</div>
              <h2 className="font-display text-4xl mt-2">Slower reads.</h2>
            </div>
            <Link to="/journal" className="text-sm link-underline">All articles</Link>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {articles.map((a) => (
              <Link key={a.id} to={`/journal/${a.slug}`} className="group">
                <div className="aspect-[4/3] overflow-hidden mb-4 rounded-md">
                  <img src={a.hero_image} alt={a.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                </div>
                <div className="overline text-secondary">{a.tags?.[0]}</div>
                <h3 className="font-display text-2xl mt-2 group-hover:text-secondary transition-colors">{a.title}</h3>
                <p className="text-sm text-muted-foreground mt-2">{a.excerpt}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Story */}
      <section className="section-pad bg-accent/40">
        <div className="container-nl grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="overline text-secondary">Our Story</div>
            <h2 className="font-display text-4xl sm:text-5xl mt-3 leading-tight">{cms?.story_headline || "Founded in a farmhouse. Built in a lab."}</h2>
            <p className="mt-6 text-muted-foreground leading-relaxed max-w-lg">{cms?.story_body}</p>
            <Link to="/transparency" className="mt-6 inline-flex items-center gap-2 link-underline text-sm">Read our transparency notes <ArrowRight className="w-4 h-4" /></Link>
          </div>
          <div className="aspect-square overflow-hidden rounded-md">
            <img src="https://images.unsplash.com/photo-1730871083804-ceaeb8c08e79?crop=entropy&cs=srgb&fm=jpg&q=85" alt="Terracotta" className="w-full h-full object-cover" />
          </div>
        </div>
      </section>
    </>
  );
}
