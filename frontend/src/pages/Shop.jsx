import React, { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import ProductCard from "@/components/ProductCard";
import { TID } from "@/constants/testIds";
import { Search } from "lucide-react";

export default function Shop() {
  const { category } = useParams();
  const [products, setProducts] = useState([]);
  const [cats, setCats] = useState([]);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("");

  useEffect(() => {
    api.get("/categories").then((r) => setCats(r.data));
  }, []);

  useEffect(() => {
    api.get("/products", { params: { category, q: q || undefined, sort: sort || undefined } })
      .then((r) => setProducts(r.data));
  }, [category, q, sort]);

  const currentCat = useMemo(() => cats.find((c) => c.slug === category), [cats, category]);

  return (
    <>
      <section className="border-b border-border/60 bg-accent/30">
        <div className="container-nl py-12 md:py-16">
          <div className="overline text-secondary">{currentCat ? currentCat.name : "The Shop"}</div>
          <h1 className="font-display text-5xl sm:text-6xl mt-3">{currentCat ? currentCat.name : "Everything we make."}</h1>
          <p className="mt-4 max-w-xl text-muted-foreground">{currentCat?.description || "Two products, deeply considered. Each traceable to a named farm and a small-batch roast."}</p>
        </div>
      </section>

      <section className="container-nl py-8">
        <div className="flex flex-wrap gap-3 items-center justify-between border-b border-border/60 pb-6">
          <div className="flex flex-wrap gap-2">
            <Link to="/shop" data-testid={TID.shop.categoryFilter("all")}
                  className={`text-xs tracking-wider uppercase px-4 py-2 rounded-full border ${!category ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary"}`}>
              All
            </Link>
            {cats.map((c) => (
              <Link key={c.id} to={`/shop/${c.slug}`} data-testid={TID.shop.categoryFilter(c.slug)}
                    className={`text-xs tracking-wider uppercase px-4 py-2 rounded-full border ${category === c.slug ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary"}`}>
                {c.name}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input data-testid={TID.shop.search} value={q} onChange={(e) => setQ(e.target.value)}
                     placeholder="Search"
                     className="pl-9 pr-3 py-2 text-sm border border-border rounded-full bg-transparent focus:outline-none focus:border-secondary w-48" />
            </div>
            <select data-testid={TID.shop.sort} value={sort} onChange={(e) => setSort(e.target.value)}
                    className="text-sm border border-border rounded-full px-3 py-2 bg-transparent">
              <option value="">Sort</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
            </select>
          </div>
        </div>

        <div data-testid={TID.shop.grid} className="mt-10 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
          {products.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
        {products.length === 0 && (
          <div className="text-center py-24 text-muted-foreground">No products match this search.</div>
        )}
      </section>
    </>
  );
}
