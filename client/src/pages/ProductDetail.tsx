import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Heart, Share2, Minus, Plus, ZoomIn } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import type { Product } from "@shared/commerce/types";
import { trpc } from "@/lib/trpc";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/components/store/WishlistContext";
import { canPurchaseProduct, isPreviewProduct } from "@/components/store/commerce-display";
import { formatMoney } from "@/lib/format";

function DetailLoading() {
  return <div className="container product-detail product-detail--loading"><div className="product-detail__media"><div className="product-skeleton" /></div><div className="product-detail__copy"><div className="product-skeleton product-skeleton--copy" /><div className="product-skeleton product-skeleton--copy" /><div className="product-skeleton product-skeleton--copy" /></div></div>;
}

function ProductView({ product }: { product: Product }) {
  const { addItem, loading } = useCart();
  const { isSaved, toggle } = useWishlist();
  const [quantity, setQuantity] = useState(1);
  const [selectedVariantId, setSelectedVariantId] = useState(product.variants[0]?.id || "");
  const [zoomOpen, setZoomOpen] = useState(false);
  const variant = product.variants.find(item => item.id === selectedVariantId) || product.variants[0];
  const preview = isPreviewProduct(product);
  const canPurchase = canPurchaseProduct(product, variant);
  const image = product.images[0];
  const saved = isSaved(product.id);

  useEffect(() => {
    document.title = `${product.title} — Indulge Essentials`;
    const description = document.querySelector('meta[name="description"]');
    if (description) description.setAttribute("content", preview ? "Development preview listing only; not for sale." : product.description.slice(0, 155));
  }, [product, preview]);

  async function addToBag() {
    if (!variant || !canPurchase) return;
    try {
      await addItem(variant.id, quantity);
      toast.success("Added to your bag");
    } catch {
      toast.error("We couldn’t update your bag. Please try again.");
    }
  }

  async function shareProduct() {
    try {
      if (navigator.share) await navigator.share({ title: product.title, url: window.location.href });
      else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success("Product link copied");
      }
    } catch {
      // Closing the native share sheet is not an error worth surfacing.
    }
  }

  const price = variant?.price || product.priceRange.min;

  return <div className="product-page container">
    <div className="page-breadcrumb"><Link href="/">Home</Link><i>/</i><Link href="/shop">Shop</Link><i>/</i><span>{product.title}</span></div>
    {preview && <div className="preview-warning" role="note"><strong>Development preview only.</strong><span>This item is not for sale. Its description, price and availability are illustrative—not a verified offer.</span></div>}
    <section className="product-detail">
      <div className="product-detail__media">
        <div className="product-detail__image">{image ? <img src={image.url} alt={image.altText || product.title} /> : <div className="product-card__image-fallback">IE</div>}
          {image && <button type="button" className="zoom-button" aria-label="Zoom product image" onClick={() => setZoomOpen(true)}><ZoomIn size={18} /></button>}
          {preview && <span className="product-badge product-badge--large">Preview item</span>}
        </div>
        <div className="image-caption"><span>THE INDULGE EDIT</span><span>{product.images.length > 0 ? `01 / ${String(product.images.length).padStart(2, "0")}` : "IMAGE COMING SOON"}</span></div>
      </div>
      <div className="product-detail__copy">
        <Link href="/shop" className="back-link"><ArrowLeft size={15} /> Back to the edit</Link>
        <p className="eyebrow">{product.productType || "EVERYDAY ESSENTIALS"}</p>
        <h1>{product.title}</h1>
        <div className="product-price-row"><strong>{formatMoney(price)}</strong>{variant?.compareAtPrice && <del>{formatMoney(variant.compareAtPrice)}</del>}</div>
        <p className="product-lead">{product.description || "A considered piece from the Indulge Essentials preview edit."}</p>
        <div className="product-state"><span className={`state-dot${variant?.availableForSale && !preview ? " is-available" : ""}`} />{preview ? "Preview listing · not for sale" : variant?.availableForSale ? "Available" : "Currently unavailable"}</div>

        {product.variants.length > 1 && <label className="variant-field">Choose an option<select value={selectedVariantId} onChange={event => setSelectedVariantId(event.target.value)}>{product.variants.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>}

        <div className="purchase-row"><div className="quantity-control quantity-control--large" aria-label="Quantity"><button type="button" aria-label="Decrease quantity" onClick={() => setQuantity(value => Math.max(1, value - 1))}><Minus size={15} /></button><span>{quantity}</span><button type="button" aria-label="Increase quantity" onClick={() => setQuantity(value => Math.min(10, value + 1))}><Plus size={15} /></button></div><button type="button" className="button button--dark purchase-button" disabled={!canPurchase || loading} onClick={() => void addToBag()}>{preview ? "Preview item — not for sale" : loading ? "Updating bag…" : "Add to bag"}{!preview && <ArrowRight size={16} />}</button></div>
        <div className="product-actions"><button type="button" className={`save-product${saved ? " is-saved" : ""}`} onClick={() => toggle(product.id)} aria-pressed={saved}><Heart size={17} fill={saved ? "currentColor" : "none"} />{saved ? "Saved to your list" : "Save for later"}</button><button type="button" className="save-product" onClick={() => void shareProduct()}><Share2 size={17} />Share</button></div>
        <div className="product-assurances"><div><Check size={15} /><span>Prices shown in Kenyan shillings</span></div><div><Check size={15} /><span>Checkout is hosted by Shopify when sales are enabled</span></div></div>
        <details className="product-accordion"><summary>Delivery information</summary><p>Delivery locations, carriers, fees and estimated dates have not been configured for this preview.</p><Link href="/pages/shipping" className="text-link">Read delivery notes <ArrowRight size={14} /></Link></details>
        <details className="product-accordion"><summary>Returns &amp; care</summary><p>The store’s final returns, refund and product-care details will be added after owner review.</p><Link href="/pages/returns" className="text-link">Read returns notes <ArrowRight size={14} /></Link></details>
      </div>
    </section>
    <section className="review-placeholder"><p className="eyebrow">CUSTOMER NOTES</p><h2>Real reviews, after real orders.</h2><p>Verified-purchase reviews will appear when the store has approved products and completed orders.</p></section>
    {zoomOpen && image && <div className="image-zoom-layer"><button type="button" className="image-zoom-backdrop" onClick={() => setZoomOpen(false)} aria-label="Close image zoom" /><div className="image-zoom-dialog" role="dialog" aria-modal="true" aria-label={`${product.title} image`}><button type="button" className="icon-button" onClick={() => setZoomOpen(false)} aria-label="Close image zoom">×</button><img src={image.url} alt={image.altText || product.title} /></div></div>}
    <div className="mobile-purchase-bar"><span><small>{preview ? "Preview only" : "Your selection"}</small><strong>{formatMoney(price)}</strong></span><button type="button" className="button button--dark" disabled={!canPurchase || loading} onClick={() => void addToBag()}>{preview ? "Not for sale" : "Add to bag"}</button></div>
  </div>;
}

export default function ProductDetail({ handle }: { handle: string }) {
  const input = useMemo(() => ({ handle }), [handle]);
  const { data: product, isLoading, error } = trpc.commerce.products.byHandle.useQuery(input, { enabled: Boolean(handle) });
  if (isLoading) return <DetailLoading />;
  if (error || !product) return <section className="container product-not-found"><p className="eyebrow">NOT IN THE EDIT</p><h1>We couldn’t find that piece.</h1><p>It may have moved or the link may be out of date.</p><Link href="/shop" className="button button--dark">Back to the shop <ArrowRight size={16} /></Link></section>;
  return <ProductView product={product} />;
}
