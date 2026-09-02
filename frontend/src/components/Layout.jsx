import React, { useState, useEffect } from "react";
import { Outlet, Link, NavLink, useLocation } from "react-router-dom";
import { ShoppingBag, User, Search, Menu, X } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import CartDrawer from "@/components/CartDrawer";
import AIChat from "@/components/AIChat";
import { LogoHorizontal, Logo } from "@/components/Logo";
import { TID } from "@/constants/testIds";

const NAV = [
  { to: "/shop",         label: "Shop",       tid: TID.header.navShop },
  { to: "/about",        label: "About Us",   tid: "nav-about" },
  { to: "/journal",      label: "Journal",    tid: TID.header.navJournal },
  { to: "/contact",      label: "Contact",    tid: "nav-contact" },
  { to: "/faq",          label: "FAQ",        tid: TID.header.navFaq },
];

const navLinkClass = ({ isActive }) =>
  `relative text-sm py-2 transition-colors ${isActive ? "text-primary font-medium" : "text-muted-foreground hover:text-primary"}`;

const ActiveDot = ({ show }) => show ? (
  <span aria-hidden className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-secondary" />
) : null;

export default function Layout() {
  const { cart, setOpen } = useCart();
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const hideChat = pathname.startsWith("/admin") || pathname.startsWith("/checkout");

  // Close mobile drawer on route change
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  return (
    <div className="min-h-screen flex flex-col">
      <header data-testid={TID.header.root} className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="container-nl flex items-center justify-between h-16 md:h-20">
          <Link to="/" data-testid={TID.header.logo} className="flex items-center">
            <LogoHorizontal />
          </Link>

          {/* Desktop primary nav */}
          <nav className="hidden lg:flex items-center gap-8" aria-label="Main">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} data-testid={n.tid} className={navLinkClass}>
                {({ isActive }) => (<span className="relative">{n.label}<ActiveDot show={isActive} /></span>)}
              </NavLink>
            ))}
          </nav>

          {/* Utility actions */}
          <div className="flex items-center gap-1">
            <Link to="/shop" className="p-2 hover:bg-accent rounded-full transition-colors" aria-label="Search">
              <Search className="w-5 h-5" />
            </Link>
            <Link to={user ? (user.role === "admin" || user.role === "editor" ? "/admin" : "/account") : "/login"}
                  data-testid={user ? TID.header.accountBtn : TID.header.loginBtn}
                  className="p-2 hover:bg-accent rounded-full transition-colors hidden sm:inline-flex" aria-label="Account">
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
            <button data-testid="mobile-menu-btn" onClick={() => setMenuOpen(true)}
                    className="p-2 hover:bg-accent rounded-full transition-colors lg:hidden" aria-label="Open menu">
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" data-testid="mobile-menu">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} />
          <aside className="absolute right-0 top-0 bottom-0 w-[86vw] max-w-sm bg-background flex flex-col animate-fade-up">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
              <LogoHorizontal className="!h-9" />
              <button onClick={() => setMenuOpen(false)} className="p-1.5 hover:bg-accent rounded-full" aria-label="Close menu">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Mobile">
              {NAV.map((n) => (
                <NavLink key={n.to} to={n.to} data-testid={`m-${n.tid}`}
                  className={({isActive}) => `flex items-center justify-between px-3 py-3 rounded-md font-display text-xl ${isActive ? "text-secondary bg-accent/60" : "text-primary hover:bg-accent/40"}`}>
                  {n.label}
                </NavLink>
              ))}
              <div className="h-px bg-border/60 my-4" />
              <Link to="/account" data-testid="m-track-order" className="block px-3 py-2 text-sm text-primary hover:text-secondary">Track Order</Link>
              <Link to="/account" data-testid="m-my-orders" className="block px-3 py-2 text-sm text-primary hover:text-secondary">My Orders</Link>
              <Link to={user ? "/account" : "/login"} data-testid="m-account" className="block px-3 py-2 text-sm text-primary hover:text-secondary">{user ? "My Account" : "Sign in"}</Link>
            </nav>
          </aside>
        </div>
      )}

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
            <div className="overline text-secondary mb-3">Explore</div>
            <ul className="space-y-2 text-sm">
              <li><Link to="/shop" className="hover:text-secondary">Shop</Link></li>
              <li><Link to="/about" className="hover:text-secondary">About Us</Link></li>
              <li><Link to="/journal" className="hover:text-secondary">Journal</Link></li>
              <li><Link to="/transparency" className="hover:text-secondary">Transparency</Link></li>
            </ul>
          </div>
          <div>
            <div className="overline text-secondary mb-3">Support</div>
            <ul className="space-y-2 text-sm">
              <li><Link to="/contact" className="hover:text-secondary">Contact</Link></li>
              <li><Link to="/faq" className="hover:text-secondary">FAQ</Link></li>
              <li><Link to="/faq" className="hover:text-secondary">Shipping & Returns</Link></li>
              <li><Link to="/faq" className="hover:text-secondary">Privacy</Link></li>
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
