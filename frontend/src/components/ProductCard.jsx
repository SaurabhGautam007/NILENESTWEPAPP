import React, { useState } from "react";
import { Link } from "react-router-dom";
import { money } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import { Plus, Minus, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { TID } from "@/constants/testIds";

export default function ProductCard({ product }) {
  const v = product.variants?.[0];
  const { cart, add, update } = useCart();
  const [busy, setBusy] = useState(false);
  const discount = v?.mrp && v.price < v.mrp ? Math.round((1 - v.price / v.mrp) * 100) : 0;
  const line = cart?.hydrated_items?.find(
    (i) => i.product_id === product.id && i.variant_id === v?.id
  );
  const qty = line?.quantity || 0;
  const oos = v?.stock_state === "OUT_OF_STOCK";

  const doAdd = async (e) => {
    e.preventDefault(); e.stopPropagation();
    if (busy || !v || oos) return;
    setBusy(true);
    try { await add(product.id, v.id, 1); toast.success(`${product.title} added`, { duration: 1400 }); }
    finally { setBusy(false); }
  };
  const inc = async (e) => { e.preventDefault(); e.stopPropagation(); if (busy) return; setBusy(true); try { await update(product.id, v.id, qty + 1); } finally { setBusy(false); } };
  const dec = async (e) => { e.preventDefault(); e.stopPropagation(); if (busy) return; setBusy(true); try { await update(product.id, v.id, qty - 1); } finally { setBusy(false); } };

  return (
    <div className="group" data-testid={TID.product.card(product.slug)}>
      <Link to={`/product/${product.slug}`} className="block">
        <div className="relative overflow-hidden bg-muted aspect-[4/5] mb-3">
          <img src={product.images?.[0]} alt={product.title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
          {discount > 0 && (
            <span className="absolute top-3 left-3 bg-secondary text-secondary-foreground text-[10px] tracking-wider uppercase px-2 py-1 rounded-full">Save {discount}%</span>
          )}
          {product.is_featured && (
            <span className="absolute top-3 right-3 bg-primary/90 text-primary-foreground text-[10px] tracking-wider uppercase px-2 py-1 rounded-full">Editor's Pick</span>
          )}
        </div>
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">{v?.name}</div>
          <div className="font-display text-xl leading-tight">{product.title}</div>
          <div className="flex items-baseline gap-2 text-sm">
            <span className="font-medium">{money(v?.price)}</span>
            {v?.mrp > v?.price && <span className="text-muted-foreground line-through text-xs">{money(v.mrp)}</span>}
          </div>
          {product.rating_count > 0 && (
            <div className="flex items-center gap-1 pt-1 text-xs text-muted-foreground">
              <span className="text-secondary">★</span><span>{product.rating_avg}</span>
              <span className="opacity-60">({product.rating_count})</span>
            </div>
          )}
        </div>
      </Link>

      <div className="mt-3">
        {oos ? (
          <button disabled className="w-full text-xs uppercase tracking-widest py-2.5 border border-border rounded-full text-muted-foreground">Out of stock</button>
        ) : qty === 0 ? (
          <button data-testid={TID.product.cardCta(product.slug)} onClick={doAdd} disabled={busy}
            className="w-full inline-flex items-center justify-center gap-2 text-xs uppercase tracking-widest py-2.5 border border-primary rounded-full hover:bg-primary hover:text-primary-foreground transition-colors">
            <ShoppingBag className="w-3.5 h-3.5" /> Add to Cart
          </button>
        ) : (
          <div className="flex items-center justify-between border border-secondary rounded-full py-1 px-1.5 bg-secondary/5">
            <button data-testid={`card-dec-${product.slug}`} onClick={dec} disabled={busy} className="w-7 h-7 rounded-full bg-background flex items-center justify-center hover:bg-accent" aria-label="Decrease">
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="text-sm font-medium">{qty} in cart</span>
            <button data-testid={`card-inc-${product.slug}`} onClick={inc} disabled={busy} className="w-7 h-7 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center hover:bg-secondary/90" aria-label="Increase">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
