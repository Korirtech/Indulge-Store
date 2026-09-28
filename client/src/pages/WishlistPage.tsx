import { useEffect } from "react";
import { ArrowRight, Heart } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import ProductCard from "@/components/store/ProductCard";
import { useWishlist } from "@/components/store/WishlistContext";

const PRODUCT_LIST_INPUT = { first: 50 } as const;

export default function WishlistPage() {
  const { data: products = [], isLoading, error } = trpc.commerce.products.list.useQuery(PRODUCT_LIST_INPUT);
  const { ids, isSaved, toggle } = useWishlist();
  useEffect(() => { document.title = "Saved pieces — Indulge Essentials"; }, []);
  const saved = products.filter(product => ids.includes(product.id));

  return <section className="wishlist-page container"><div className="page-breadcrumb"><Link href="/">Home</Link><i>/</i><span>Saved pieces</span></div><div className="shop-intro"><div><p className="eyebrow">YOUR PERSONAL EDIT</p><h1>Saved for <em>later.</em></h1><p>Keep the pieces you love close while you explore.</p></div><div className="wishlist-count"><Heart size={18} />{ids.length} saved</div></div>
    {isLoading ? <div className="product-grid">{Array.from({ length: 2 }, (_, index) => <div className="product-skeleton" key={index} />)}</div>
      : error ? <div className="notice-card" role="status"><strong>Your saved pieces couldn’t load.</strong><span>Please refresh in a moment.</span></div>
      : saved.length > 0 ? <div className="product-grid">{saved.map(product => <ProductCard key={product.id} product={product} saved={isSaved(product.id)} onToggleSaved={() => toggle(product.id)} />)}</div>
      : <div className="empty-catalog empty-catalog--shop"><span className="empty-catalog__icon"><Heart size={19} /></span><h3>Nothing saved just yet.</h3><p>Tap the heart on a product and it will be waiting for you here, in this browser.</p><Link href="/shop" className="button button--dark">Find something good <ArrowRight size={16} /></Link></div>}
  </section>;
}
