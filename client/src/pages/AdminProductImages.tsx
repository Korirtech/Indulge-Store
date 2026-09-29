import { useDeferredValue, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ImagePlus,
  LoaderCircle,
  Package,
  Search,
  ShieldCheck,
  Tag,
  Trash2,
  Upload,
  Warehouse,
  X,
} from "lucide-react";
import { Link } from "wouter";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { formatMoney } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import "./AdminProductImages.css";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_UPLOAD_BATCH = 8;
const PRODUCT_DETAIL_MEDIA_LIMIT = 100;
const PRODUCT_DETAIL_VARIANT_LIMIT = 250;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

type Notice = { kind: "success" | "error" | "info"; text: string };

function formatBytes(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      if (comma < 0) reject(new Error(`Could not encode ${file.name}.`));
      else resolve(result.slice(comma + 1));
    };
    reader.readAsDataURL(file);
  });
}

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function AdminProductImages() {
  const { user, loading: authLoading } = useAuth();
  const isAdmin = user?.role === "admin";
  const fileInput = useRef<HTMLInputElement>(null);
  const [searchText, setSearchText] = useState("");
  const deferredSearch = useDeferredValue(searchText.trim());
  const [productId, setProductId] = useState("");
  const [tab, setTab] = useState<"images" | "inventory">("images");
  const [locationId, setLocationId] = useState("");
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>({});
  const [altDrafts, setAltDrafts] = useState<Record<string, string>>({});
  const [draftProductId, setDraftProductId] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [uploadAltText, setUploadAltText] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; name: string } | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  const status = trpc.adminMedia.status.useQuery(undefined, { enabled: isAdmin });
  const adminReady = Boolean(status.data?.adminApiConfigured);
  const catalog = trpc.adminMedia.catalog.useInfiniteQuery(
    { query: deferredSearch || undefined },
    {
      getNextPageParam: lastPage => lastPage.nextCursor ?? undefined,
      enabled: isAdmin && adminReady,
    }
  );
  const products = catalog.data?.pages.flatMap(page => page.products) ?? [];
  const selectedProductInput = useMemo(() => ({ productId }), [productId]);
  const details = trpc.adminMedia.productDetails.useQuery(selectedProductInput, {
    enabled: isAdmin && adminReady && Boolean(productId),
  });
  const locations = trpc.adminMedia.locations.useQuery(undefined, {
    enabled: isAdmin && adminReady,
  });
  const utils = trpc.useUtils();
  const uploadMutation = trpc.adminMedia.uploadProductImage.useMutation();
  const updateAltMutation = trpc.adminMedia.updateImageAlt.useMutation();
  const removeImageMutation = trpc.adminMedia.removeProductImage.useMutation();
  const updatePriceMutation = trpc.adminMedia.updateVariantPrice.useMutation();
  const setInventoryMutation = trpc.adminMedia.setInventory.useMutation();

  useEffect(() => {
    if (catalog.data && products.length === 0) {
      setProductId("");
      return;
    }
    if (products.length === 0) return;
    if (!productId || !products.some(product => product.id === productId)) {
      setProductId(products[0]!.id);
    }
  }, [products, productId]);

  useEffect(() => {
    const availableLocations = locations.data ?? [];
    if (availableLocations.length === 0) {
      setLocationId("");
      return;
    }
    if (!locationId || !availableLocations.some(location => location.id === locationId)) {
      setLocationId(availableLocations[0]!.id);
    }
  }, [locations.data, locationId]);

  useEffect(() => {
    const product = details.data;
    if (!product || product.id === draftProductId) return;
    setPriceDrafts(Object.fromEntries(product.variants.map(variant => [variant.id, variant.price])));
    setAltDrafts(Object.fromEntries(product.images.map(image => [image.id, image.alt])));
    setQuantityDrafts({});
    setDraftProductId(product.id);
    setUploadAltText(product.title);
    setNotice(null);
    setConfirmRemoveId(null);
  }, [details.data, draftProductId]);

  function chooseFiles(fileList: FileList | File[]) {
    setNotice(null);
    const files = Array.from(fileList);
    if (files.length > MAX_UPLOAD_BATCH) {
      setNotice({ kind: "error", text: `Choose up to ${MAX_UPLOAD_BATCH} images per batch.` });
      return;
    }
    const invalid = files.find(file => !ACCEPTED_TYPES.includes(file.type) || file.size > MAX_IMAGE_BYTES || file.size === 0);
    if (invalid) {
      setNotice({ kind: "error", text: `${invalid.name} is not supported. Use JPG, PNG, or WebP, up to 8 MB each.` });
      return;
    }
    setSelectedFiles(files);
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.currentTarget.files) chooseFiles(event.currentTarget.files);
    event.currentTarget.value = "";
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    if (event.dataTransfer.files.length) chooseFiles(event.dataTransfer.files);
  }

  async function invalidateProduct() {
    if (!productId) return;
    await Promise.all([
      utils.adminMedia.productDetails.invalidate({ productId }),
      utils.adminMedia.catalog.invalidate(),
    ]);
  }

  async function uploadSelected() {
    if (!productId || selectedFiles.length === 0 || !adminReady) return;
    setNotice(null);
    setIsUploading(true);
    let successCount = 0;
    const errors: string[] = [];

    for (let index = 0; index < selectedFiles.length; index += 1) {
      const file = selectedFiles[index]!;
      setUploadProgress({ current: index + 1, total: selectedFiles.length, name: file.name });
      try {
        const imageBase64 = await readBase64(file);
        await uploadMutation.mutateAsync({
          productId,
          fileName: file.name,
          mimeType: file.type as "image/jpeg" | "image/png" | "image/webp",
          altText: uploadAltText.trim() || undefined,
          imageBase64,
        });
        successCount += 1;
      } catch (error) {
        errors.push(`${file.name}: ${errorText(error, "Upload failed.")}`);
      }
    }

    setIsUploading(false);
    setUploadProgress(null);
    setSelectedFiles([]);
    if (successCount > 0) await invalidateProduct();
    if (errors.length > 0) {
      setNotice({
        kind: successCount > 0 ? "info" : "error",
        text: `${successCount} uploaded. ${errors.slice(0, 2).join(" ")}${errors.length > 2 ? ` And ${errors.length - 2} more failed.` : ""}`,
      });
    } else if (successCount > 0) {
      setNotice({
        kind: "success",
        text: `${successCount} ${successCount === 1 ? "image" : "images"} sent to Shopify. Shopify processes product media asynchronously, so it may take a short moment to appear.`,
      });
    }
  }

  async function saveImageAlt(mediaId: string) {
    if (!productId) return;
    setNotice(null);
    try {
      await updateAltMutation.mutateAsync({ productId, mediaId, alt: altDrafts[mediaId] ?? "" });
      setNotice({ kind: "success", text: "Image alt text saved to Shopify." });
      await invalidateProduct();
    } catch (error) {
      setNotice({ kind: "error", text: errorText(error, "Could not update the image alt text.") });
    }
  }

  async function removeImage(mediaId: string) {
    if (!productId) return;
    setNotice(null);
    try {
      await removeImageMutation.mutateAsync({ productId, mediaId });
      setConfirmRemoveId(null);
      setNotice({ kind: "success", text: "Image removed from this product. Its file remains in Shopify Files." });
      await invalidateProduct();
    } catch (error) {
      setNotice({ kind: "error", text: errorText(error, "Could not remove this product image.") });
    }
  }

  async function savePrice(variantId: string) {
    if (!productId) return;
    setNotice(null);
    try {
      const result = await updatePriceMutation.mutateAsync({
        productId,
        variantId,
        price: priceDrafts[variantId] ?? "",
      });
      setPriceDrafts(current => ({ ...current, [variantId]: result.price }));
      setNotice({ kind: "success", text: "Variant price updated in Shopify." });
      await invalidateProduct();
    } catch (error) {
      setNotice({ kind: "error", text: errorText(error, "Could not update the variant price.") });
    }
  }

  async function saveInventory(variantId: string, expectedCurrent: number | null) {
    if (!productId || !locationId || expectedCurrent === null) return;
    const draft = quantityDrafts[`${variantId}:${locationId}`] ?? String(expectedCurrent);
    const quantity = Number(draft);
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > 2_147_483_647) {
      setNotice({ kind: "error", text: "Enter a whole stock quantity of 0 or more." });
      return;
    }

    setNotice(null);
    try {
      const result = await setInventoryMutation.mutateAsync({
        productId,
        variantId,
        locationId,
        quantity,
        expectedCurrent,
        idempotencyKey: crypto.randomUUID(),
      });
      setQuantityDrafts(current => ({ ...current, [`${variantId}:${locationId}`]: String(result.quantity) }));
      setNotice({ kind: "success", text: "Available inventory updated in Shopify." });
      await invalidateProduct();
    } catch (error) {
      setNotice({ kind: "error", text: errorText(error, "Could not update inventory.") });
      if (error instanceof Error && /stock changed/i.test(error.message)) await invalidateProduct();
    }
  }

  if (authLoading) {
    return <section className="admin-images container"><div className="admin-images__loading"><LoaderCircle className="spin" size={22} /> Checking your access…</div></section>;
  }

  if (!user) {
    return <section className="admin-images container"><div className="admin-images__access"><span className="admin-images__seal"><ShieldCheck size={23} /></span><p className="eyebrow">STORE ADMINISTRATION</p><h1>Sign in to manage the catalog</h1><p>This workspace is available only to an authorized store administrator.</p><button type="button" className="button button--dark" onClick={() => startLogin()}>Sign in securely <ArrowLeft size={15} /></button></div></section>;
  }

  if (!isAdmin) {
    return <section className="admin-images container"><div className="admin-images__access"><span className="admin-images__seal"><ShieldCheck size={23} /></span><p className="eyebrow">RESTRICTED AREA</p><h1>Administrator access required</h1><p>Your signed-in account does not have permission to change the store catalog.</p><Link className="button button--outline" href="/">Return to the store <ArrowLeft size={15} /></Link></div></section>;
  }

  const selectedProduct = details.data;
  const lastCatalogPage = catalog.data?.pages[catalog.data.pages.length - 1];
  const hasNextPage = lastCatalogPage?.hasNextPage ?? false;

  return <section className="admin-images container">
    <div className="admin-images__topline"><Link href="/shop" className="admin-images__back"><ArrowLeft size={15} /> Back to the shop</Link><span><ShieldCheck size={15} /> ADMIN ONLY</span></div>
    <header className="admin-images__header"><div><p className="eyebrow"><span className="eyebrow-mark" /> STORE OPERATIONS</p><h1>Catalog <em>dashboard</em></h1><p>Manage product photography, variant prices, and location-level available stock. Changes are saved directly to Shopify.</p></div><span className="admin-images__header-mark"><Package size={27} /></span></header>

    {status.isLoading && <div className="admin-images__notice admin-images__notice--info"><LoaderCircle className="spin" size={17} /> Checking Shopify Admin configuration…</div>}
    {status.isError && <div className="admin-images__notice admin-images__notice--error">Could not check Shopify configuration. Refresh the page and try again.</div>}
    {status.data && !adminReady && <div className="admin-images__notice admin-images__notice--info"><ShieldCheck size={18} /><span><strong>Setup needed before catalog changes.</strong> Configure a server-only Shopify Admin API token with <code>read_products</code>, <code>write_products</code>, <code>write_files</code>, <code>read_inventory</code>, <code>write_inventory</code>, and <code>read_locations</code>. The Admin token never belongs in browser code.</span></div>}
    {notice && <div className={`admin-images__notice admin-images__notice--${notice.kind}`} role="status">{notice.kind === "success" ? <Check size={17} /> : notice.kind === "error" ? <X size={17} /> : <ImagePlus size={17} />}<span>{notice.text}</span></div>}

    <div className="catalog-dashboard">
      <aside className="catalog-sidebar">
        <div className="catalog-sidebar__heading"><div><p className="eyebrow">SHOPIFY ADMIN</p><h2>Products</h2></div><span>{products.length}</span></div>
        <label className="catalog-search"><Search size={16} /><span className="sr-only">Search products</span><input type="search" value={searchText} onChange={event => setSearchText(event.target.value)} placeholder="Search product titles" disabled={!adminReady} /></label>
        {catalog.isLoading && <div className="admin-images__loading"><LoaderCircle className="spin" size={18} /> Loading products…</div>}
        {catalog.isError && <div className="admin-images__inline-error">Products could not be loaded. Check the Admin API scopes and refresh.</div>}
        {!catalog.isLoading && !catalog.isError && products.length === 0 && adminReady && <div className="admin-images__empty">No products match this search.</div>}
        <div className="catalog-product-list" role="list" aria-label="Shopify products">
          {products.map(product => <button type="button" role="listitem" key={product.id} className={`catalog-product${productId === product.id ? " is-selected" : ""}`} onClick={() => { setProductId(product.id); setNotice(null); }} aria-current={productId === product.id ? "true" : undefined}>
            <span className="catalog-product__image">{product.imageUrl ? <img src={product.imageUrl} alt={product.imageAlt || ""} /> : <Package size={18} />}</span>
            <span className="catalog-product__text"><strong>{product.title}</strong><small>{product.status.toLowerCase()} · {product.productType || "Uncategorized"}</small></span>
          </button>)}
        </div>
        {hasNextPage && <button type="button" className="catalog-load-more" onClick={() => void catalog.fetchNextPage()} disabled={catalog.isFetchingNextPage}>{catalog.isFetchingNextPage ? <LoaderCircle className="spin" size={15} /> : <ChevronDown size={15} />} Load more products</button>}
      </aside>

      <section className="catalog-workspace" aria-label="Selected product management">
        {!productId && !catalog.isLoading && <div className="catalog-workspace__empty"><Package size={28} /><h2>Choose a product</h2><p>Select a product from the catalog to manage its images, pricing, and stock.</p></div>}
        {productId && details.isLoading && <div className="admin-images__loading catalog-loading"><LoaderCircle className="spin" size={20} /> Loading product details…</div>}
        {productId && details.isError && <div className="admin-images__notice admin-images__notice--error">Product details could not be loaded. Verify the product and Admin API scopes.</div>}
        {selectedProduct && <>
          <header className="catalog-product-header"><div><p className="eyebrow">{selectedProduct.productType || "PRODUCT"} <i>·</i> {selectedProduct.status}</p><h2>{selectedProduct.title}</h2><p>/{selectedProduct.handle}</p></div><span className="catalog-product-header__status"><span /> {selectedProduct.status.toLowerCase()}</span></header>
          <div className="catalog-tabs" role="tablist" aria-label="Product management sections">
            <button type="button" role="tab" aria-selected={tab === "images"} className={tab === "images" ? "is-active" : ""} onClick={() => setTab("images")}><ImagePlus size={16} /> Images <span>{selectedProduct.images.length}</span></button>
            <button type="button" role="tab" aria-selected={tab === "inventory"} className={tab === "inventory" ? "is-active" : ""} onClick={() => setTab("inventory")}><Tag size={16} /> Inventory &amp; prices <span>{selectedProduct.variants.length}</span></button>
          </div>

          {tab === "images" && <div className="catalog-section">
            <div className="catalog-section__heading"><div><p className="eyebrow">PRODUCT GALLERY</p><h3>Existing images</h3><p>Update accessible descriptions or remove an image from this product.</p></div><button type="button" className="button button--outline catalog-add-button" onClick={() => setShowUpload(value => !value)}><ImagePlus size={16} /> {showUpload ? "Close upload" : "Add images"}</button></div>
            {selectedProduct.images.length === 0 && <div className="admin-images__empty">This product has no images yet. Add the first image from your device.</div>}
            {selectedProduct.hasMoreImages && <p className="catalog-limit-note">Showing the first {PRODUCT_DETAIL_MEDIA_LIMIT} images. Use Shopify Admin to review any additional media.</p>}
            {selectedProduct.images.length > 0 && <div className="catalog-image-grid">{selectedProduct.images.map(image => <article className="catalog-image-card" key={image.id}>
              <div className="catalog-image-card__preview">{image.url ? <img src={image.url} alt={image.alt} loading="lazy" /> : <span><ImagePlus size={22} /> {image.status.toLowerCase()}</span>}<small>{image.status.toLowerCase()}</small></div>
              <label className="catalog-image-card__alt"><span>Alt text</span><input value={altDrafts[image.id] ?? image.alt} onChange={event => setAltDrafts(current => ({ ...current, [image.id]: event.target.value }))} maxLength={255} disabled={image.status !== "READY" || updateAltMutation.isPending} /></label>
              <div className="catalog-image-card__actions"><button type="button" className="catalog-quiet-button" disabled={image.status !== "READY" || updateAltMutation.isPending || (altDrafts[image.id] ?? image.alt) === image.alt} onClick={() => void saveImageAlt(image.id)}><Check size={14} /> Save alt text</button><button type="button" className="catalog-delete-button" disabled={image.status !== "READY" || removeImageMutation.isPending} onClick={() => { setConfirmRemoveId(confirmRemoveId === image.id ? null : image.id); setNotice(null); }}><Trash2 size={14} /> Remove</button></div>
              {confirmRemoveId === image.id && <div className="catalog-image-card__confirm" role="group" aria-label="Confirm image removal"><strong>Remove from this product?</strong><p>The image file stays in Shopify Files. This also clears variant image links for this product.</p><div><button type="button" className="catalog-quiet-button" onClick={() => setConfirmRemoveId(null)}>Keep image</button><button type="button" className="catalog-delete-button" disabled={removeImageMutation.isPending} onClick={() => void removeImage(image.id)}>{removeImageMutation.isPending ? "Removing…" : "Confirm remove"}</button></div></div>}
            </article>)}</div>}

            {showUpload && <div className="catalog-upload-panel"><div className="catalog-section__heading"><div><p className="eyebrow">ADD FROM DEVICE</p><h3>Upload new images</h3><p>JPG, PNG, or WebP · up to 8 MB each · maximum 8 per batch.</p></div></div>
              <label className={`admin-images__dropzone${isDragging ? " is-dragging" : ""}`} onDragOver={event => { event.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={onDrop}>
                <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={onFileChange} aria-label="Choose product images" />
                <span className="admin-images__drop-icon"><Upload size={21} /></span><strong>Drop images here, or <u>browse files</u></strong><small>Files are validated and sent directly to Shopify.</small>
              </label>
              {selectedFiles.length > 0 && <div className="admin-images__file-list" aria-live="polite">{selectedFiles.map(file => <div className="admin-images__file" key={`${file.name}-${file.size}-${file.lastModified}`}><span className="admin-images__file-icon"><ImagePlus size={16} /></span><span className="admin-images__file-name">{file.name}<small>{formatBytes(file.size)}</small></span><button type="button" aria-label={`Remove ${file.name}`} disabled={isUploading} onClick={() => setSelectedFiles(current => current.filter(item => item !== file))}><X size={16} /></button></div>)}</div>}
              <label className="admin-images__field"><span>Alt text <small>optional, shared across this batch</small></span><input type="text" value={uploadAltText} onChange={event => setUploadAltText(event.target.value)} maxLength={255} placeholder="Describe what the image shows" /></label>
              {isUploading && uploadProgress && <div className="admin-images__progress" role="status"><LoaderCircle className="spin" size={16} /><span>Uploading {uploadProgress.current} of {uploadProgress.total}: {uploadProgress.name}</span></div>}
              <button type="button" className="button button--dark admin-images__submit" disabled={!adminReady || selectedFiles.length === 0 || isUploading} onClick={() => void uploadSelected()}>{isUploading ? <><LoaderCircle className="spin" size={16} /> Uploading…</> : <><Upload size={16} /> Upload {selectedFiles.length || "images"} to Shopify</>}</button>
            </div>}
          </div>}

          {tab === "inventory" && <div className="catalog-section catalog-inventory">
            <div className="catalog-section__heading"><div><p className="eyebrow">VARIANT CONTROLS</p><h3>Inventory &amp; prices</h3><p>Update each variant's selling price and available quantity at a Shopify location.</p></div></div>
            <label className="catalog-location"><Warehouse size={17} /><span>Inventory location</span><select value={locationId} onChange={event => setLocationId(event.target.value)} disabled={locations.isLoading || !locations.data?.length}><option value="">Select location</option>{locations.data?.map(location => <option key={location.id} value={location.id}>{location.name}</option>)}</select><ChevronDown size={15} /></label>
            {locations.isLoading && <div className="admin-images__loading"><LoaderCircle className="spin" size={18} /> Loading locations…</div>}
            {locations.isError && <div className="admin-images__inline-error">Locations could not be loaded. Confirm the Admin app has <code>read_locations</code> access.</div>}
            {!locations.isLoading && locations.data?.length === 0 && <div className="admin-images__empty">No active Shopify locations were found.</div>}
            {selectedProduct.hasMoreVariants && <p className="catalog-limit-note">Showing the first {PRODUCT_DETAIL_VARIANT_LIMIT} variants. Use Shopify Admin for products with additional variants.</p>}
            {selectedProduct.variants.length > 0 && <div className="catalog-variant-list">{selectedProduct.variants.map(variant => {
              const level = variant.inventoryLevels.find(item => item.locationId === locationId);
              const currentQuantity = level?.available ?? null;
              const quantityKey = `${variant.id}:${locationId}`;
              const priceValue = priceDrafts[variant.id] ?? variant.price;
              const quantityValue = quantityDrafts[quantityKey] ?? (currentQuantity === null ? "" : String(currentQuantity));
              const canSetQuantity = Boolean(locationId && variant.tracked && level?.active && currentQuantity !== null);
              return <article className="catalog-variant-card" key={variant.id}>
                <div className="catalog-variant-card__title"><span className="catalog-variant-card__icon"><Package size={17} /></span><div><strong>{variant.title === "Default Title" ? "Default variant" : variant.title}</strong><small>{variant.sku ? `SKU ${variant.sku}` : "No SKU"}</small></div></div>
                <div className="catalog-variant-fields">
                  <label><span>Price <small>{selectedProduct.currencyCode}</small></span><div className="catalog-input-with-save"><input type="number" min="0" step="0.01" value={priceValue} onChange={event => setPriceDrafts(current => ({ ...current, [variant.id]: event.target.value }))} aria-label={`Price for ${variant.title}`} disabled={updatePriceMutation.isPending} /><button type="button" className="catalog-save-button" onClick={() => void savePrice(variant.id)} disabled={updatePriceMutation.isPending || priceValue === variant.price || priceValue.trim() === ""}>{updatePriceMutation.isPending ? <LoaderCircle className="spin" size={14} /> : <Check size={14} />}<span>Save</span></button></div><small className="catalog-current-value">Current: {formatMoney(variant.price, selectedProduct.currencyCode)}</small></label>
                  <label><span>Available <small>{locations.data?.find(item => item.id === locationId)?.name ?? "location"}</small></span><div className="catalog-input-with-save"><input type="number" min="0" step="1" value={quantityValue} onChange={event => setQuantityDrafts(current => ({ ...current, [quantityKey]: event.target.value }))} aria-label={`Available stock for ${variant.title}`} disabled={!canSetQuantity || setInventoryMutation.isPending} placeholder={variant.tracked ? "Not stocked" : "Not tracked"} /><button type="button" className="catalog-save-button" onClick={() => void saveInventory(variant.id, currentQuantity)} disabled={!canSetQuantity || setInventoryMutation.isPending || quantityValue === String(currentQuantity)}>{setInventoryMutation.isPending ? <LoaderCircle className="spin" size={14} /> : <Check size={14} />}<span>Save</span></button></div><small className={`catalog-current-value${!canSetQuantity ? " is-muted" : ""}`}>{!variant.tracked ? "Inventory tracking is off" : !level?.active ? "Not stocked at this location" : `Current: ${currentQuantity ?? "—"} available`}</small></label>
                </div>
              </article>;
            })}</div>}
          </div>}
        </>}
      </section>
    </div>
    <p className="catalog-dashboard__footnote"><ShieldCheck size={14} /> Protected by the store admin role. Price and stock changes are written to Shopify; inventory updates use a stale-value check before saving.</p>
  </section>;
}
