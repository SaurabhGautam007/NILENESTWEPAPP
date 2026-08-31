import React from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCart } from "@/context/CartContext";
import { Link, useNavigate } from "react-router-dom";
import { money } from "@/lib/api";
import { Minus, Plus, X } from "lucide-react";
import { TID } from "@/constants/testIds";

export default function CartDrawer() {
  const { cart, open, setOpen, update } = useCart();
  const navigate = useNavigate();

  const goCheckout = () => { setOpen(false); navigate("/checkout"); };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent data-testid={TID.cart.drawer} side="right" className="w-full sm:max-w-md bg-background flex flex-col">
        <SheetHeader className="border-b border-border/60 pb-4">
          <SheetTitle className="font-display text-2xl">Your Basket</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {cart.hydrated_items?.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <p className="font-display text-2xl mb-2">Nothing here yet.</p>
              <Link to="/shop" onClick={() => setOpen(false)} className="text-secondary link-underline text-sm">Browse the shop</Link>
            </div>
          )}
          {cart.hydrated_items?.map((it) => (
            <div key={it.product_id + it.variant_id} data-testid={TID.cart.item(it.variant_id)} className="flex gap-4 py-3 border-b border-border/40">
              <img src={it.image} alt={it.title} className="w-20 h-20 object-cover rounded-md" />
              <div className="flex-1 flex flex-col">
                <div className="flex justify-between">
                  <div>
                    <div className="text-sm font-medium">{it.title}</div>
                    <div className="text-xs text-muted-foreground">{it.variant_name}</div>
                  </div>
                  <button onClick={() => update(it.product_id, it.variant_id, 0)} className="text-muted-foreground hover:text-secondary">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="mt-auto flex justify-between items-center">
                  <div className="flex items-center border border-border rounded-full">
                    <button data-testid={TID.cart.dec(it.variant_id)} onClick={() => update(it.product_id, it.variant_id, it.quantity - 1)} className="p-1.5 hover:bg-accent rounded-l-full">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="px-3 text-sm">{it.quantity}</span>
                    <button data-testid={TID.cart.inc(it.variant_id)} onClick={() => update(it.product_id, it.variant_id, it.quantity + 1)} className="p-1.5 hover:bg-accent rounded-r-full">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="text-sm">{money(it.line_total)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        {cart.hydrated_items?.length > 0 && (
          <div className="border-t border-border/60 pt-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">{money(cart.subtotal)}</span>
            </div>
            {cart.savings > 0 && (
              <div className="flex justify-between text-xs text-secondary">
                <span>You saved</span><span>{money(cart.savings)}</span>
              </div>
            )}
            <button data-testid={TID.cart.checkoutBtn} onClick={goCheckout} className="btn-primary w-full">
              Continue to checkout · {money(cart.subtotal)}
            </button>
            <p className="text-xs text-center text-muted-foreground">Free shipping over ₹499</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
