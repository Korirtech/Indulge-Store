import { useEffect, useMemo, useState } from "react";
import { Search, SlidersHorizontal, X, ArrowDownWideNarrow } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import ProductCard from "@/components/store/ProductCard";
import { useWishlist } from "@/components/store/WishlistContext";
import type { Product } from "@shared/commerce/types";

const PRODUCT_LIST_INPUT = { first: 50 } as const;

type SortMode = "featured" | "price-low" | "price-high" | "name";

function productPrice(product: Product) {
  return Number.parseFloat(product.priceRange.min.amount) || 0;
}

export default function Shop() {
  const { data: products = [], isLoading, error } = trpc.commerce.products.list.useQuery(PRODUCT_LIST_INPUT);
  const { isSaved, toggle } = useWishlist();
  const [location] = useLocation();
  const [query, setQuery] = useState(() => new URLSearchParams(window.location.search).get("q") || "");
  const [type, setType] = useState(() => new URLSearchParams(window.location.search).get("type") || "all");
  const [sort, setSort] = useState<SortMode>("featured");
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setQuery(params.get("q") || "");
    setType(params.get("type") || "all");
  }, [location]);

  useEffect(() => {
    document.title = query ? `Search: ${query} — Indulge Essentials` : "Shop the edit — Indulge Essentials";
  }, [query]);

  const productTypes = useMemo(() => Array.from(new Set(products.map(item => item.productType).filter((value): value is string => Boolean(value)))), [products]);
  const visibleProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const result = products.filter(product => {
      const searchable = [product.title, product.description, product.productType || "", product.vendor || "", ...product.tags].join(" ").toLowerCase();
      return (!normalized || searchable.includes(normalized)) && (type === "all" || product.productType === type);
    });
    if (sort === "price-low") result.sort((a, b) => productPrice(a) - productPrice(b));
    if (sort === "price-high") result.sort((a, b) => productPrice(b) - productPrice(a));
    if (sort === "name") result.sort((a, b) => a.title.localeCompare(b.title));
    return result;
  }, [products, query, type, sort]);

  function clearFilters() {
    setQuery("");
    setType("all");
    window.history.replaceState(null, "", "/shop");
  }

  return (
    <div className="shop-page container">
      <div className="page-breadcrumb"><span>Home</span><i>/</i><span>Shop</span></div>
      <section className="shop-intro">
        <div><p className="eyebrow">THE INDULGE EDIT</p><h1>Shop the <em>good things.</em></h1><p>Useful, thoughtful essentials—chosen to make the everyday feel a little more special.</p></div>
        <div className="shop-note"><span className="shop-note__seal">IE</span><p>Our development catalog is intentionally small. Preview items are not for sale.</p></div>
      </section>

      <div className="shop-toolbar">
        <div className="shop-count"><strong>{isLoading ? "—" : visibleProducts.length}</strong> {visibleProducts.length === 1 ? "piece" : "pieces"}<span>{query && <> matching “{query}”</>}</span></div>
        <div className="shop-controls">
          <button type="button" className={`filter-toggle${filtersOpen ? " is-active" : ""}`} onClick={() => setFiltersOpen(open => !open)} aria-expanded={filtersOpen}><SlidersHorizontal size={16} /> Filters <span>{filtersOpen ? "Close" : "Open"}</span></button>
          <label className="sort-control"><ArrowDownWideNarrow size={15} /><span>Sort:</span><select aria-label="Sort products" value={sort} onChange={event => setSort(event.target.value as SortMode)}><option value="featured">Featured</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="name">Name</option></select></label>
        </div>
      </div>

      <div className={`shop-body${filtersOpen ? " filters-visible" : ""}`}>
        <aside className="filter-panel" aria-label="Product filters">
          <div className="filter-panel__heading"><h2>Refine</h2><button type="button" className="icon-button filter-close" onClick={() => setFiltersOpen(false)} aria-label="Close filters"><X size={18} /></button></div>
          <label className="filter-label" htmlFor="shop-query">Search the edit</label>
          <div className="filter-search"><Search size={16} /><input id="shop-query" value={query} onChange={event => setQuery(event.target.value)} placeholder="Try ‘serum’" /></div>
          <label className="filter-label" htmlFor="shop-type">Department</label>
          <select id="shop-type" className="filter-select" value={type} onChange={event => setType(event.target.value)}><option value="all">All departments</option>{productTypes.map(item => <option key={item} value={item}>{item}</option>)}</select>
          <button type="button" className="filter-reset" onClick={clearFilters}>Clear filters <X size={14} /></button>
          <div className="filter-aside-note"><span>Editor’s note</span><p>Real stock, delivery options and approved prices will be confirmed before the store opens for orders.</p></div>
        </aside>

        <div className="shop-results">
          {isLoading ? (
            <div className="product-grid">{Array.from({ length: 4 }, (_, index) => <div className="product-skeleton" key={index} />)}</div>
          ) : error ? (
            <div className="notice-card notice-card--error" role="status"><strong>We couldn’t load the edit.</strong><span>Please refresh in a moment. No order or payment has been started.</span></div>
          ) : visibleProducts.length > 0 ? (
            <div className="product-grid">{visibleProducts.map(product => <ProductCard key={product.id} product={product} saved={isSaved(product.id)} onToggleSaved={() => toggle(product.id)} />)}</div>
          ) : (
            <div className="empty-catalog empty-catalog--shop"><span className="empty-catalog__icon"><Search size={19} /></span><h3>No pieces found just yet.</h3><p>Try a different search or clear the filters. The next edit is being thoughtfully assembled.</p><button type="button" className="button button--outline" onClick={clearFilters}>Clear search and filters</button></div>
          )}
        </div>
      </div>
    </div>
  );
}
