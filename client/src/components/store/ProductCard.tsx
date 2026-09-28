import { Heart, ArrowUpRight } from "lucide-react";
import { Link } from "wouter";
import type { Product } from "@shared/commerce/types";
import { formatMoney } from "@/lib/format";
import { isPreviewProduct } from "./commerce-display";

type ProductCardProps = {
  product: Product;
  saved: boolean;
  onToggleSaved: () => void;
};

export default function ProductCard({ product, saved, onToggleSaved }: ProductCardProps) {
  const image = product.images[0];
  const preview = isPreviewProduct(product);
  const variant = product.variants[0];

  return (
    <article className="product-card">
      <div className="product-card__visual">
        <Link href={`/products/${product.handle}`} className="product-card__image-link" aria-label={`View ${product.title}`}>
          {image ? (
            <img src={image.url} alt={image.altText || product.title} loading="lazy" />
          ) : (
            <div className="product-card__image-fallback" aria-label="Product image coming soon">IE</div>
          )}
        </Link>
        {preview && <span className="product-badge">Preview item</span>}
        <button
          type="button"
          className={`favorite-button${saved ? " is-saved" : ""}`}
          onClick={onToggleSaved}
          aria-label={saved ? `Remove ${product.title} from saved items` : `Save ${product.title}`}
          aria-pressed={saved}
        >
          <Heart size={18} strokeWidth={1.7} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="product-card__body">
        <div className="product-card__meta">
          <span>{product.productType || "Everyday essentials"}</span>
          {variant?.availableForSale && !preview && <span className="stock-dot">Available</span>}
        </div>
        <Link href={`/products/${product.handle}`} className="product-card__title">
          {product.title}<ArrowUpRight size={16} aria-hidden="true" />
        </Link>
        <div className="product-card__price">{formatMoney(product.priceRange.min)}</div>
        {preview && <p className="product-card__note">Development listing · not for sale</p>}
      </div>
    </article>
  );
}
