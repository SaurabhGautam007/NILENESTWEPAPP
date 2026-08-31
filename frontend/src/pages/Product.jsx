import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, money } from "@/lib/api";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useCart } from "@/context/CartContext";
import { TID } from "@/constants/testIds";
import { toast } from "sonner";
import { Star, Leaf, Shield, Truck } from "lucide-react";

export default function Product() {
  const { slug } = useParams();
  const [product, setProduct] = useState(null);
  const [variantId, setVariantId] = useState(null);
  const [imgIdx, setImgIdx] = useState(0);
  const { add } = useCart();

  useEffect(() => {
    api.get(`/products/${slug}`).then((r) => {
      setProduct(r.data);
      setVariantId(r.data.variants?.[0]?.id);
      setImgIdx(0);
    });
  }, [slug]);

  if (!product) return <div className="container-nl py-24 text-center text-muted-foreground">Loading…</div>;
  const variant = product.variants.find((v) => v.id === variantId) || product.variants[0];
  const discount = variant.mrp > variant.price ? Math.round((1 - variant.price / variant.mrp) * 100) : 0;

  const addToCart = async () => {
    await add(product.id, variant.id, 1);
    toast.success(`${product.title} added to basket`);
  };

  return (
    <section className="container-nl py-10 lg:py-16">
      <nav className="text-xs text-muted-foreground mb-8">
        <Link to="/shop" className="hover:text-primary">Shop</Link><span className="mx-2">/</span>
        <span className="text-primary">{product.title}</span>
      </nav>

      <div className="grid lg:grid-cols-2 gap-10 lg:gap-16">
        {/* Gallery */}
        <div>
          <div className="aspect-[4/5] overflow-hidden bg-muted rounded-md mb-4">
            <img src={product.images[imgIdx]} alt={product.title} className="w-full h-full object-cover" />
          </div>
          <div className="flex gap-3">
            {product.images.map((im, i) => (
              <button key={i} onClick={() => setImgIdx(i)}
                className={`w-20 h-20 overflow-hidden rounded-md border-2 transition-colors ${i === imgIdx ? "border-secondary" : "border-transparent"}`}>
                <img src={im} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        {/* Info */}
        <div>
          <div className="overline text-secondary">{product.subtitle}</div>
          <h1 data-testid={TID.product.title} className="font-display text-4xl sm:text-5xl mt-3 leading-tight">{product.title}</h1>

          <div className="flex items-center gap-3 mt-4 text-sm">
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className={`w-4 h-4 ${i < Math.round(product.rating_avg) ? "fill-secondary text-secondary" : "text-border"}`} />
              ))}
            </div>
            <span className="text-muted-foreground">{product.rating_avg} · {product.rating_count} reviews</span>
          </div>

          <div className="mt-6 flex items-baseline gap-3">
            <span data-testid={TID.product.price} className="font-display text-4xl">{money(variant.price)}</span>
            {variant.mrp > variant.price && <>
              <span className="text-lg text-muted-foreground line-through">{money(variant.mrp)}</span>
              <span className="text-secondary text-sm">Save {discount}%</span>
            </>}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Inclusive of all taxes</p>

          <p className="mt-6 text-base leading-relaxed">{product.description}</p>

          <div className="mt-8">
            <div className="overline text-muted-foreground mb-2">Size</div>
            <div className="flex flex-wrap gap-2">
              {product.variants.map((v) => (
                <button key={v.id} data-testid={`${TID.product.variantSelect}-${v.id}`}
                  onClick={() => setVariantId(v.id)}
                  className={`px-4 py-2 text-sm border rounded-md transition-colors ${v.id === variantId ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary"}`}>
                  {v.name} · {money(v.price)}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 text-xs text-secondary">
            {variant.stock_state === "OUT_OF_STOCK" ? "Out of stock" :
             variant.stock_state === "LOW_STOCK" ? `Only ${variant.stock} left` : "In stock, ships in 24 hrs"}
          </div>

          <button data-testid={TID.product.addToCart} onClick={addToCart}
            disabled={variant.stock_state === "OUT_OF_STOCK"}
            className="btn-primary w-full mt-6 disabled:opacity-40">
            Add to basket · {money(variant.price)}
          </button>

          <div className="grid grid-cols-3 gap-3 mt-8 pt-8 border-t border-border/60 text-xs">
            <div className="flex flex-col items-center text-center gap-1">
              <Leaf className="w-5 h-5 text-secondary" /> <span>{product.certifications[0] || "Certified"}</span>
            </div>
            <div className="flex flex-col items-center text-center gap-1">
              <Shield className="w-5 h-5 text-secondary" /> <span>Small batch</span>
            </div>
            <div className="flex flex-col items-center text-center gap-1">
              <Truck className="w-5 h-5 text-secondary" /> <span>Free over ₹499</span>
            </div>
          </div>

          {/* Transparency accordion */}
          <div className="mt-10 bg-accent/40 p-6 rounded-md">
            <div className="overline text-secondary mb-3">Transparency Panel</div>
            <Accordion type="single" collapsible defaultValue="ingredients">
              <AccordionItem value="ingredients" data-testid={TID.product.ingredients}>
                <AccordionTrigger className="font-display text-lg">Ingredients</AccordionTrigger>
                <AccordionContent>
                  <ul className="space-y-1 text-sm">
                    {product.ingredients.map((i) => <li key={i}>· {i}</li>)}
                  </ul>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="nutrition" data-testid={TID.product.nutrition}>
                <AccordionTrigger className="font-display text-lg">Nutrition</AccordionTrigger>
                <AccordionContent>
                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    {Object.entries(product.nutrition).map(([k, v]) => (
                      <React.Fragment key={k}>
                        <dt className="text-muted-foreground">{k}</dt><dd>{v}</dd>
                      </React.Fragment>
                    ))}
                  </dl>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="transparency" data-testid={TID.product.transparency}>
                <AccordionTrigger className="font-display text-lg">Origin & Batch</AccordionTrigger>
                <AccordionContent>
                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    {product.transparency.map((t) => (
                      <React.Fragment key={t.title}>
                        <dt className="text-muted-foreground">{t.title}</dt><dd>{t.value}</dd>
                      </React.Fragment>
                    ))}
                  </dl>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="cert">
                <AccordionTrigger className="font-display text-lg">Certifications</AccordionTrigger>
                <AccordionContent>
                  <div className="flex flex-wrap gap-2">
                    {product.certifications.map((c) => (
                      <span key={c} className="text-xs px-3 py-1 border border-border rounded-full">{c}</span>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </div>

      {/* Story */}
      {product.story && (
        <div className="mt-24 grid lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-5">
            <div className="overline text-secondary">Story</div>
            <h2 className="font-display text-4xl mt-3">Where it comes from.</h2>
          </div>
          <p className="lg:col-span-7 text-lg leading-relaxed text-muted-foreground">{product.story}</p>
        </div>
      )}
    </section>
  );
}
