import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const CartCtx = createContext(null);

export const CartProvider = ({ children }) => {
  const { user } = useAuth();
  const [cart, setCart] = useState({ hydrated_items: [], subtotal: 0, item_count: 0 });
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const getCartId = () => localStorage.getItem("nn_cart_id");
  const setCartId = (id) => { if (id) localStorage.setItem("nn_cart_id", id); };

  const refresh = useCallback(async () => {
    const cid = getCartId();
    const { data } = await api.get("/cart", { params: cid ? { cart_id: cid } : {} });
    setCart(data);
    setCartId(data.id);
    return data;
  }, []);

  useEffect(() => { refresh(); }, [refresh, user]);

  const add = async (product_id, variant_id, quantity = 1) => {
    setLoading(true);
    try {
      const cid = getCartId();
      const { data } = await api.post("/cart/items", { product_id, variant_id, quantity }, { params: cid ? { cart_id: cid } : {} });
      setCart(data); setCartId(data.id); setOpen(true);
    } finally { setLoading(false); }
  };

  const update = async (product_id, variant_id, quantity) => {
    const cid = getCartId();
    const { data } = await api.patch("/cart/items", { product_id, variant_id, quantity }, { params: cid ? { cart_id: cid } : {} });
    setCart(data);
  };

  return <CartCtx.Provider value={{ cart, refresh, add, update, open, setOpen, loading }}>{children}</CartCtx.Provider>;
};

export const useCart = () => useContext(CartCtx);
