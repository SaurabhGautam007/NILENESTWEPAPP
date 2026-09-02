import React from "react";
import { Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Splash from "@/components/Splash";
import Home from "@/pages/Home";
import Shop from "@/pages/Shop";
import Product from "@/pages/Product";
import Checkout from "@/pages/Checkout";
import OrderConfirm from "@/pages/OrderConfirm";
import OrderTracking from "@/pages/OrderTracking";
import Journal from "@/pages/Journal";
import Article from "@/pages/Article";
import Faq from "@/pages/Faq";
import Transparency from "@/pages/Transparency";
import Contact from "@/pages/Contact";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Account from "@/pages/Account";
import Admin from "@/pages/Admin";
import NotFound from "@/pages/NotFound";
import "@/App.css";

export default function App() {
  return (
    <div className="App">
      <Splash />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/shop/:category" element={<Shop />} />
          <Route path="/product/:slug" element={<Product />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/order/:orderNumber" element={<OrderConfirm />} />
          <Route path="/track/:orderNumber" element={<OrderTracking />} />
          <Route path="/journal" element={<Journal />} />
          <Route path="/journal/:slug" element={<Article />} />
          <Route path="/faq" element={<Faq />} />
          <Route path="/transparency" element={<Transparency />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/account" element={<Account />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </div>
  );
}
