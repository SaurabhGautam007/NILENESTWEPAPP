import React from "react";
import { Link } from "react-router-dom";
import { money } from "@/lib/api";
import { TID } from "@/constants/testIds";

export default function ProductCard({ product }) {
  const v = product.variants?.[0];
  const discount = v?.mrp && v.price < v.mrp ? Math.round((1 - v.price / v.mrp) * 100) : 0;
  const hasReviews = product.rating_count > 0;
  return (
    <Link to={`/product/${product.slug}`} data-testid={TID.product.card(product.slug)} className="group block">
      <div className="relative overflow-hidden bg-muted aspect-[4/5] mb-3">
        <img src={product.images?.[0]} alt={product.title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
        {discount > 0 && (
          <span className="absolute top-3 left-3 bg-secondary text-secondary-foreground text-[10px] tracking-wider uppercase px-2 py-1 rounded-full">
            Save {discount}%
          </span>
        )}
        {product.is_featured && (
          <span className="absolute top-3 right-3 bg-primary/90 text-primary-foreground text-[10px] tracking-wider uppercase px-2 py-1 rounded-full">
            Editor's Pick
          </span>
        )}
      </div>
      <div className="space-y-1">
        <div className="text-xs text-muted-foreground">{v?.name}</div>
        <div className="font-display text-xl leading-tight">{product.title}</div>
        <div className="flex items-baseline gap-2 text-sm">
          <span className="font-medium">{money(v?.price)}</span>
          {v?.mrp > v?.price && <span className="text-muted-foreground line-through text-xs">{money(v.mrp)}</span>}
        </div>
        {hasReviews && (
          <div className="flex items-center gap-1 pt-1 text-xs text-muted-foreground">
            <span className="text-secondary">★</span>
            <span>{product.rating_avg}</span>
            <span className="opacity-60">({product.rating_count})</span>
          </div>
        )}
      </div>
    </Link>
  );
}
