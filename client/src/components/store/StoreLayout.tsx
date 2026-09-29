import { useState, type FormEvent, type ReactNode } from "react";
import { ArrowRight, Heart, Menu, Search, ShoppingBag, UserRound, X, Minus, Plus, Trash2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "./WishlistContext";
import { formatMoney } from "@/lib/format";
import { useAuth } from "@/_core/hooks/useAuth";

function SearchBox({ mobile = false }: { mobile?: boolean }) {
  const [value, setValue] = useState("");
  const [, setLocation] = useLocation();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = value.trim();
    setLocation(query ? `/shop?q=${encodeURIComponent(query)}` : "/shop");
  }
  return <form className={mobile ? "search-form search-form--mobile" : "search-form"} role="search" onSubmit={submit}>
    <label className="sr-only" htmlFor={mobile ? "mobile-search" : "desktop-search"}>Search products</label><Search size={17} aria-hidden="true" />
    <input id={mobile ? "mobile-search" : "desktop-search"} value={value} onChange={event => setValue(event.target.value)} placeholder="Search the edit" autoComplete="off" />
    <button type="submit" aria-label="Search"><ArrowRight size={16} /></button>
  </form>;
}

function Header() {
  const { itemCount, openCart } = useCart();
  const { ids } = useWishlist();
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  return <>
    <div className="top-ribbon"><span>Curated essentials for everyday rituals</span><span className="top-ribbon__right">Shopping in KES <i>·</i> Kenya-first setup</span></div>
    <header className="site-header">
      <div className="site-header__main">
        <button type="button" className="icon-button menu-toggle" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} onClick={() => setMenuOpen(value => !value)}>{menuOpen ? <X size={21} /> : <Menu size={21} />}</button>
        <Link href="/" className="brand-lockup" aria-label="Indulge Essentials home"><span className="brand-mark">i</span><span className="brand-name">indulge<span>essentials</span></span></Link>
        <nav className="desktop-nav" aria-label="Main navigation"><Link href="/shop">Shop</Link><Link href="/pages/about">Our point of view</Link>{user?.role === "admin" && <Link href="/admin/catalog">Catalog dashboard</Link>}</nav>
        <div className="header-search"><SearchBox /></div>
        <div className="header-actions">
          <Link href="/account" className="header-action"><UserRound size={20} /><span>Account</span></Link>
          <Link href="/wishlist" className="header-action" aria-label={`Saved items, ${ids.length} saved`}><Heart size={20} /><span>Saved</span>{ids.length > 0 && <b className="count-pill">{ids.length}</b>}</Link>
          <button type="button" className="header-action" onClick={openCart} aria-label={`Shopping bag, ${itemCount} items`}><span className="bag-icon"><ShoppingBag size={20} />{itemCount > 0 && <b className="count-dot">{itemCount}</b>}</span><span>Bag</span></button>
        </div>
      </div>
      <div className="mobile-search"><SearchBox mobile /></div>
      <nav className={`mobile-menu${menuOpen ? " is-open" : ""}`} aria-label="Mobile navigation"><Link href="/shop" onClick={() => setMenuOpen(false)}>Shop the edit</Link><Link href="/pages/about" onClick={() => setMenuOpen(false)}>Our point of view</Link><Link href="/pages/shipping" onClick={() => setMenuOpen(false)}>Delivery information</Link>{user?.role === "admin" && <Link href="/admin/catalog" onClick={() => setMenuOpen(false)}>Catalog dashboard</Link>}</nav>
    </header>
  </>;
}

function CartDrawer() {
  const { cart, isOpen, closeCart, loading, updateQuantity, removeItem, proceedToCheckout } = useCart();
  if (!isOpen) return null;
  return <div className="cart-layer"><button className="cart-backdrop" onClick={closeCart} aria-label="Close shopping bag" />
    <section className="cart-panel" role="dialog" aria-modal="true" aria-labelledby="cart-title">
      <div className="cart-panel__header"><div><p className="eyebrow">YOUR EDIT</p><h2 id="cart-title">Shopping bag <span>({cart?.itemCount ?? 0})</span></h2></div><button type="button" className="icon-button" onClick={closeCart} aria-label="Close shopping bag"><X size={21} /></button></div>
      {!cart || cart.items.length === 0 ? <div className="cart-empty"><div className="cart-empty__icon"><ShoppingBag size={24} /></div><h3>Your bag is taking a breather.</h3><p>Browse the current edit and save anything that catches your eye.</p><Link className="button button--dark" href="/shop" onClick={closeCart}>Explore the shop <ArrowRight size={16} /></Link></div> : <>
        <div className="cart-lines">{cart.items.map(item => <article className="cart-line" key={item.lineId}>
          <div className="cart-line__image">{item.image ? <img src={item.image.url} alt={item.image.altText || item.productTitle} /> : <span>IE</span>}</div>
          <div className="cart-line__details"><Link href={`/products/${item.productHandle}`} onClick={closeCart}>{item.productTitle}</Link>{item.variantTitle !== "Default Title" && <small>{item.variantTitle}</small>}<strong>{formatMoney(item.lineTotal)}</strong>
            <div className="quantity-control" aria-label={`Quantity for ${item.productTitle}`}><button type="button" disabled={loading} aria-label="Decrease quantity" onClick={() => void updateQuantity(item.lineId, item.quantity - 1)}><Minus size={13} /></button><span>{item.quantity}</span><button type="button" disabled={loading} aria-label="Increase quantity" onClick={() => void updateQuantity(item.lineId, item.quantity + 1)}><Plus size={13} /></button></div>
          </div><button type="button" className="remove-line" aria-label={`Remove ${item.productTitle}`} disabled={loading} onClick={() => void removeItem(item.lineId)}><Trash2 size={16} /></button>
        </article>)}</div>
        <div className="cart-panel__bottom"><div className="cart-subtotal"><span>Subtotal</span><strong>{formatMoney(cart.subtotal)}</strong></div><p>Shipping and any applicable taxes are confirmed at checkout.</p><button type="button" className="button button--dark button--full" onClick={proceedToCheckout} disabled={loading || cart.itemCount === 0}>Continue to secure checkout <ArrowRight size={16} /></button><button type="button" className="text-button cart-continue" onClick={closeCart}>Continue browsing</button></div>
      </>}
    </section>
  </div>;
}

function Footer() {
  return <footer className="site-footer"><div className="footer-main">
    <div className="footer-brand"><Link href="/" className="brand-lockup brand-lockup--footer"><span className="brand-mark">i</span><span className="brand-name">indulge<span>essentials</span></span></Link><p>Good things, chosen with care. A considered edit for everyday living.</p></div>
    <div className="footer-links"><h3>Explore</h3><Link href="/shop">Shop all</Link><Link href="/wishlist">Saved pieces</Link><Link href="/pages/about">Our story</Link></div>
    <div className="footer-links"><h3>Customer care</h3><Link href="/pages/shipping">Delivery</Link><Link href="/pages/returns">Returns</Link><Link href="/pages/contact">Contact</Link><Link href="/pages/faqs">FAQs</Link></div>
    <div className="footer-note"><span className="footer-note__seal">IE</span><p>Thoughtful essentials.<br />A little more everyday.</p></div>
  </div><div className="footer-bottom"><span>© {new Date().getFullYear()} Indulge Essentials</span><span>Kenya <i>·</i> KES <i>·</i> English</span><div><Link href="/pages/privacy">Privacy</Link><Link href="/pages/terms">Terms</Link></div></div></footer>;
}

function MobileDock() {
  const { itemCount, openCart } = useCart();
  const { ids } = useWishlist();
  return <nav className="mobile-dock" aria-label="Quick navigation"><Link href="/" className="mobile-dock__item"><span className="dock-icon">i</span><span>Home</span></Link><Link href="/shop" className="mobile-dock__item"><Search size={20} /><span>Shop</span></Link><Link href="/wishlist" className="mobile-dock__item"><span className="dock-count-wrap"><Heart size={20} />{ids.length > 0 && <b>{ids.length}</b>}</span><span>Saved</span></Link><button type="button" className="mobile-dock__item" onClick={openCart}><span className="dock-count-wrap"><ShoppingBag size={20} />{itemCount > 0 && <b>{itemCount}</b>}</span><span>Bag</span></button></nav>;
}

export default function StoreLayout({ children }: { children: ReactNode }) {
  return <div className="store-shell"><Header /><main id="main-content">{children}</main><Footer /><MobileDock /><CartDrawer /></div>;
}
