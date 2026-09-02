import React from "react";
import { Outlet, Link, NavLink, useLocation } from "react-router-dom";
import { ShoppingBag, User, Search } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import CartDrawer from "@/components/CartDrawer";
import AIChat from "@/components/AIChat";
import { LogoHorizontal, Logo } from "@/components/Logo";
import { TID } from "@/constants/testIds";

const nav = [
  { to: "/shop", label: "Shop", tid: TID.header.navShop },
  { to: "/journal", label: "Journal", tid: TID.header.navJournal },
  { to: "/transparency", label: "Transparency", tid: TID.header.navTransparency },
  { to: "/faq", label: "FAQ", tid: TID.header.navFaq },
];

export default function Layout() {
  const { cart, setOpen } = useCart();
  const { user } = useAuth();
  const { pathname } = useLocation();
  const hideChat = pathname.startsWith("/admin") || pathname.startsWith("/checkout");

  return (
    <div className="min-h-screen flex flex-col">
      <header data-testid={TID.header.root} className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="container-nl flex items-center justify-between h-20 md:h-24">
          <Link to="/" data-testid={TID.header.logo} className="flex items-center group">
            <LogoHorizontal />
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} data-testid={n.tid}
                className={({isActive}) => `text-sm ${isActive ? "text-primary font-medium" : "text-muted-foreground hover:text-primary"} transition-colors`}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-1">
            <Link to="/shop" className="p-2 hover:bg-accent rounded-full transition-colors" aria-label="Search">
              <Search className="w-5 h-5" />
            </Link>
            <Link to={user ? (user.role === "admin" || user.role === "editor" ? "/admin" : "/account") : "/login"}
                  data-testid={user ? TID.header.accountBtn : TID.header.loginBtn}
                  className="p-2 hover:bg-accent rounded-full transition-colors" aria-label="Account">
              <User className="w-5 h-5" />
            </Link>
            <button data-testid={TID.header.cartBtn} onClick={() => setOpen(true)}
                    className="relative p-2 hover:bg-accent rounded-full transition-colors" aria-label="Open cart">
              <ShoppingBag className="w-5 h-5" />
              {cart.item_count > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-secondary text-secondary-foreground rounded-full text-[10px] w-5 h-5 flex items-center justify-center font-medium">
                  {cart.item_count}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="mt-24 border-t border-border/60 bg-accent/40">
        <div className="container-nl py-16 grid grid-cols-2 md:grid-cols-4 gap-10">
          <div className="col-span-2">
            <Logo />
            <p className="mt-6 text-sm text-muted-foreground max-w-xs leading-relaxed">
              Premium wellness essentials, traceable to a farm, a harvest, and a hand.
            </p>
          </div>
          <div>
            <div className="overline text-secondary mb-3">Shop</div>
            <ul className="space-y-2 text-sm">
              <li><Link to="/shop/teas-infusions" className="hover:text-secondary">Teas & Infusions</Link></li>
              <li><Link to="/shop/clean-snacks" className="hover:text-secondary">Clean Snacks</Link></li>
              <li><Link to="/shop" className="hover:text-secondary">All Products</Link></li>
            </ul>
          </div>
          <div>
            <div className="overline text-secondary mb-3">Company</div>
            <ul className="space-y-2 text-sm">
              <li><Link to="/transparency" className="hover:text-secondary">Transparency</Link></li>
              <li><Link to="/journal" className="hover:text-secondary">Journal</Link></li>
              <li><Link to="/contact" className="hover:text-secondary">Contact</Link></li>
              <li><Link to="/faq" className="hover:text-secondary">FAQ</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border/60">
          <div className="container-nl py-6 text-xs text-muted-foreground flex flex-wrap justify-between gap-4">
            <span>© {new Date().getFullYear()} NileNest. Made slowly, in India.</span>
            <span>FSSAI · India Organic · GMP Certified</span>
          </div>
        </div>
      </footer>
      <CartDrawer />
      {!hideChat && <AIChat />}
    </div>
  );
}
