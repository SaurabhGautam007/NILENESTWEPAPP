import React, { createContext, useContext, useRef } from "react";

const AIContext = createContext(null);

export const AIContextProvider = ({ children }) => {
  const productIdRef = useRef(null);
  const openRef = useRef(null); // will be set by AIChat: () => setOpen(true)
  const value = {
    setProduct: (id) => { productIdRef.current = id; },
    getProduct: () => productIdRef.current,
    registerOpener: (fn) => { openRef.current = fn; },
    open: () => openRef.current && openRef.current(),
  };
  return <AIContext.Provider value={value}>{children}</AIContext.Provider>;
};

export const useAIContext = () => useContext(AIContext);
