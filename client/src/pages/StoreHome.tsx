import { useEffect } from "react";
import { ArrowDown, ArrowRight, Sparkles, ShieldCheck, MapPin, Leaf } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import ProductCard from "@/components/store/ProductCard";
import { useWishlist } from "@/components/store/WishlistContext";

const PRODUCT_LIST_INPUT = { first: 25 } as const;
const HERO_IMAGE = "/images/indulge-editorial-hero.jpg";

export default function StoreHome() {
  const { data: products = [], isLoading, error } = trpc.commerce.products.list.useQuery(PRODUCT_LIST_INPUT);
  const { isSaved, toggle } = useWishlist();
  useEffect(() => { document.title = "Indulge Essentials — Good things, chosen with care"; }, []);

  const departments = products.map(product => product.productType).filter((value): value is string => Boolean(value)).filter((value, index, list) => list.indexOf(value) === index);

  return (
    <div className="home-page">
      <section className="hero-section container">
        <div className="hero-copy">
          <p className="eyebrow"><span className="eyebrow-mark" /> THE GOOD-THINGS EDIT</p>
          <h1>Everyday, made a little more <em>indulgent.</em></h1>
          <p className="hero-description">Considered essentials for your rituals, your home, and the moments in between. Chosen with care, made to feel like you.</p>
          <div className="hero-actions"><Link href="/shop" className="button button--dark">Discover the edit <ArrowRight size={17} /></Link><Link href="/pages/about" className="text-link">Our point of view <ArrowDown size={15} /></Link></div>
          <div className="hero-caption"><span className="caption-rule" /> A LITTLE MORE CARE, IN THE EVERYDAY</div>
        </div>
        <div className="hero-visual"><img src={HERO_IMAGE} alt="A calm morning skincare ritual in a sunlit home" fetchPriority="high" /><div className="hero-stamp"><span>THE</span><strong>daily<br />ritual</strong><span>EDIT NO. 01</span></div><div className="hero-image-note"><span>01 / 01</span><span>Soft starts, thoughtfully made</span></div></div>
      </section>

      <section className="promise-strip container" aria-label="Store information">
        <div><span className="promise-icon"><Sparkles size={18} /></span><span><strong>Considered, not crowded</strong><small>A focused edit of everyday pieces</small></span></div>
        <div><span className="promise-icon"><MapPin size={18} /></span><span><strong>Made for Kenya</strong><small>Clear KES pricing from the start</small></span></div>
        <div><span className="promise-icon"><ShieldCheck size={18} /></span><span><strong>Hosted checkout pathway</strong><small>Payments are not yet enabled</small></span></div>
      </section>

      <section className="edit-section container">
        <div className="section-heading"><div><p className="eyebrow">A SMALLER, BETTER EDIT</p><h2>Good things, <em>for every day.</em></h2></div><p>Thoughtful picks are on their way. The development catalog is intentionally lean while the real assortment is being confirmed.</p></div>
        <div className="edit-chips">
          {departments.length > 0 ? departments.map(item => <Link key={item} href={`/shop?type=${encodeURIComponent(item)}`} className="edit-chip"><Leaf size={16} />{item}<ArrowRight size={14} /></Link>) : <Link href="/shop" className="edit-chip"><Leaf size={16} />Explore the first edit<ArrowRight size={14} /></Link>}
          <Link href="/shop?type=Beauty" className="edit-chip edit-chip--quiet">Beauty &amp; body <span>Coming into focus</span></Link>
          <Link href="/shop?type=Home" className="edit-chip edit-chip--quiet">Home rituals <span>Coming into focus</span></Link>
        </div>
      </section>

      <section className="featured-section"><div className="container">
        <div className="section-heading section-heading--featured"><div><p className="eyebrow">THE FIRST LOOK</p><h2>Begin with <em>something good.</em></h2></div><Link href="/shop" className="text-link">View the edit <ArrowRight size={16} /></Link></div>
        {isLoading ? <div className="product-grid product-grid--loading" aria-label="Loading products"><div className="product-skeleton" /><div className="product-skeleton" /></div>
          : error ? <div className="notice-card" role="status"><strong>The edit is taking a moment.</strong><span>We couldn’t load the catalog just now. Please try again shortly.</span></div>
          : products.length > 0 ? <div className="product-grid product-grid--home">{products.slice(0, 3).map(product => <ProductCard key={product.id} product={product} saved={isSaved(product.id)} onToggleSaved={() => toggle(product.id)} />)}<div className="editorial-card"><div className="editorial-card__mark"><Leaf size={22} /></div><p className="eyebrow">A NOTE ON OUR EDIT</p><h3>Less browsing.<br /><em>Better finding.</em></h3><p>We believe the best essentials are the ones you reach for again and again. The full collection is being thoughtfully assembled.</p><Link href="/pages/about" className="text-link">Get to know us <ArrowRight size={16} /></Link></div></div>
          : <div className="empty-catalog"><span className="empty-catalog__icon"><Sparkles size={20} /></span><h3>Your next favourite is being chosen.</h3><p>The storefront is ready. Approved products will appear here as they are added.</p><Link href="/pages/contact" className="text-link">Ask about the launch <ArrowRight size={16} /></Link></div>}
      </div></section>

      <section className="story-band container"><div className="story-band__icon"><Leaf size={26} strokeWidth={1.4} /></div><div><p className="eyebrow">A LITTLE MORE INTENTION</p><h2>For the things you use.<br /><em>And the way they make you feel.</em></h2></div><p>Indulge Essentials is being shaped around simple pleasures, useful details, and a more personal way to shop for everyday goods.</p><Link href="/pages/about" className="round-arrow" aria-label="Read our point of view"><ArrowRight size={18} /></Link></section>
      <section className="closing-note container"><span className="closing-note__line" /><p>Good things take a little choosing.</p><Link href="/shop" className="text-link">See what’s here <ArrowRight size={15} /></Link></section>
    </div>
  );
}
