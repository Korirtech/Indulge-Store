import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { ArrowLeft, Check, ImagePlus, LoaderCircle, ShieldCheck, Upload, X } from "lucide-react";
import { Link } from "wouter";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import "./AdminProductImages.css";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

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

export default function AdminProductImages() {
  const { user, loading: authLoading } = useAuth();
  const isAdmin = user?.role === "admin";
  const fileInput = useRef<HTMLInputElement>(null);
  const [productId, setProductId] = useState("");
  const [altText, setAltText] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; name: string } | null>(null);
  const [notice, setNotice] = useState<{ kind: "success" | "error" | "info"; text: string } | null>(null);
  const [uploadedCount, setUploadedCount] = useState(0);

  const status = trpc.adminMedia.status.useQuery(undefined, { enabled: isAdmin });
  const products = trpc.adminMedia.products.useQuery(undefined, { enabled: isAdmin });
  const uploadMutation = trpc.adminMedia.uploadProductImage.useMutation();
  const utils = trpc.useUtils();

  function chooseFiles(fileList: FileList | File[]) {
    setNotice(null);
    const files = Array.from(fileList);
    if (files.length > 8) {
      setNotice({ kind: "error", text: "Choose up to 8 images per batch." });
      return;
    }
    const invalid = files.find(file => !ACCEPTED_TYPES.includes(file.type) || file.size > MAX_IMAGE_BYTES || file.size === 0);
    if (invalid) {
      setNotice({ kind: "error", text: `${invalid.name} is not supported. Use JPG, PNG, or WebP, up to 8 MB each.` });
      return;
    }
    setSelectedFiles(files);
    setUploadedCount(0);
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

  async function uploadSelected() {
    if (!productId || selectedFiles.length === 0 || !status.data?.adminApiConfigured) return;
    setNotice(null);
    setIsUploading(true);
    let successCount = 0;
    const errors: string[] = [];

    for (let index = 0; index < selectedFiles.length; index += 1) {
      const file = selectedFiles[index];
      setProgress({ current: index + 1, total: selectedFiles.length, name: file.name });
      try {
        const imageBase64 = await readBase64(file);
        await uploadMutation.mutateAsync({
          productId,
          fileName: file.name,
          mimeType: file.type as "image/jpeg" | "image/png" | "image/webp",
          altText: altText.trim() || undefined,
          imageBase64,
        });
        successCount += 1;
      } catch (error) {
        errors.push(`${file.name}: ${error instanceof Error ? error.message : "Upload failed."}`);
      }
    }

    setIsUploading(false);
    setProgress(null);
    setUploadedCount(successCount);
    setSelectedFiles([]);
    if (successCount > 0) await utils.commerce.invalidate();
    if (errors.length > 0) {
      setNotice({
        kind: successCount > 0 ? "info" : "error",
        text: `${successCount} uploaded. ${errors.slice(0, 2).join(" ")}${errors.length > 2 ? ` And ${errors.length - 2} more failed.` : ""}`,
      });
    } else if (successCount > 0) {
      setNotice({
        kind: "success",
        text: `${successCount} ${successCount === 1 ? "image" : "images"} sent to Shopify. Shopify processes product media asynchronously, so it may take a short moment to appear on the storefront.`,
      });
    }
  }

  if (authLoading) {
    return <section className="admin-images container"><div className="admin-images__loading"><LoaderCircle className="spin" size={22} /> Checking your access…</div></section>;
  }

  if (!user) {
    return <section className="admin-images container"><div className="admin-images__access"><span className="admin-images__seal"><ShieldCheck size={23} /></span><p className="eyebrow">STORE ADMINISTRATION</p><h1>Sign in to manage product images</h1><p>This area is available only to an authorized store administrator.</p><button type="button" className="button button--dark" onClick={() => startLogin()}>Sign in securely <ArrowLeft size={15} /></button></div></section>;
  }

  if (!isAdmin) {
    return <section className="admin-images container"><div className="admin-images__access"><span className="admin-images__seal"><ShieldCheck size={23} /></span><p className="eyebrow">RESTRICTED AREA</p><h1>Administrator access required</h1><p>Your signed-in account does not have permission to change the store catalog.</p><Link className="button button--outline" href="/">Return to the store <ArrowLeft size={15} /></Link></div></section>;
  }

  const adminReady = Boolean(status.data?.adminApiConfigured && status.data?.storefrontConfigured);

  return <section className="admin-images container">
    <div className="admin-images__topline"><Link href="/shop" className="admin-images__back"><ArrowLeft size={15} /> Back to the shop</Link><span><ShieldCheck size={15} /> ADMIN ONLY</span></div>
    <header className="admin-images__header"><div><p className="eyebrow"><span className="eyebrow-mark" /> CATALOG TOOLS</p><h1>Product <em>image studio</em></h1><p>Bring your product gallery to life. Images are uploaded directly to Shopify and appear on the storefront after processing.</p></div><span className="admin-images__header-mark"><ImagePlus size={27} /></span></header>

    {status.isLoading && <div className="admin-images__notice admin-images__notice--info"><LoaderCircle className="spin" size={17} /> Checking Shopify configuration…</div>}
    {status.isError && <div className="admin-images__notice admin-images__notice--error">Could not check Shopify configuration. Refresh the page and try again.</div>}
    {status.data && !adminReady && <div className="admin-images__notice admin-images__notice--info"><ShieldCheck size={18} /><span><strong>Setup needed before uploads.</strong> Configure the Shopify Storefront API and a server-only Shopify Admin API token with <code>write_files</code> and <code>write_products</code> scopes. Never place the Admin token in browser code.</span></div>}

    <div className="admin-images__workspace">
      <div className="admin-images__form-card">
        <div className="admin-images__step"><span>01</span><div><h2>Choose a product</h2><p>Select the Shopify product that should receive these images.</p></div></div>
        {products.isLoading ? <div className="admin-images__loading"><LoaderCircle className="spin" size={18} /> Loading products…</div> : products.isError ? <div className="admin-images__inline-error">The Shopify product list could not be loaded. Check the Storefront API settings and refresh.</div> : products.data?.length ? <label className="admin-images__field"><span>Shopify product</span><select value={productId} onChange={event => setProductId(event.target.value)}><option value="">Select a product</option>{products.data.map(product => <option key={product.id} value={product.id}>{product.title}</option>)}</select></label> : <div className="admin-images__empty">No published products are available. Add or publish a product in Shopify first.</div>}

        <div className="admin-images__step admin-images__step--second"><span>02</span><div><h2>Add image files</h2><p>JPG, PNG, or WebP · up to 8 MB each · maximum 8 per batch.</p></div></div>
        <label className={`admin-images__dropzone${isDragging ? " is-dragging" : ""}`} onDragOver={event => { event.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={onDrop}>
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={onFileChange} aria-label="Choose product images" />
          <span className="admin-images__drop-icon"><Upload size={21} /></span><strong>Drop images here, or <u>browse files</u></strong><small>Your images go straight to Shopify—no local server storage.</small>
        </label>

        {selectedFiles.length > 0 && <div className="admin-images__file-list" aria-live="polite">{selectedFiles.map(file => <div className="admin-images__file" key={`${file.name}-${file.size}-${file.lastModified}`}><span className="admin-images__file-icon"><ImagePlus size={16} /></span><span className="admin-images__file-name">{file.name}<small>{formatBytes(file.size)}</small></span><button type="button" aria-label={`Remove ${file.name}`} disabled={isUploading} onClick={() => setSelectedFiles(current => current.filter(item => item !== file))}><X size={16} /></button></div>)}</div>}

        <label className="admin-images__field admin-images__alt"><span>Alt text <small>optional, for accessibility</small></span><input type="text" value={altText} onChange={event => setAltText(event.target.value)} maxLength={255} placeholder="Describe what the image shows" /></label>
        {notice && <div className={`admin-images__notice admin-images__notice--${notice.kind}`} role="status">{notice.kind === "success" ? <Check size={17} /> : notice.kind === "error" ? <X size={17} /> : <ImagePlus size={17} />}<span>{notice.text}</span></div>}
        {isUploading && progress && <div className="admin-images__progress" role="status"><LoaderCircle className="spin" size={16} /><span>Uploading {progress.current} of {progress.total}: {progress.name}</span></div>}
        <button type="button" className="button button--dark admin-images__submit" disabled={!adminReady || !productId || selectedFiles.length === 0 || isUploading} onClick={() => void uploadSelected()}>{isUploading ? <><LoaderCircle className="spin" size={16} /> Uploading…</> : <><Upload size={16} /> Upload {selectedFiles.length || "images"} to Shopify</>}</button>
        {uploadedCount > 0 && <p className="admin-images__success-count"><Check size={14} /> {uploadedCount} image{uploadedCount === 1 ? "" : "s"} accepted by Shopify.</p>}
      </div>

      <aside className="admin-images__side-card"><span className="admin-images__side-icon"><ShieldCheck size={19} /></span><p className="eyebrow">SECURE BY DESIGN</p><h2>Your catalog stays in Shopify</h2><p>The Admin API credential never leaves the server. Each upload is checked for size and image type before Shopify receives it.</p><div className="admin-images__side-rule" /><p className="admin-images__side-note"><strong>Supported files</strong><span>JPEG · PNG · WebP</span></p><p className="admin-images__side-note"><strong>Maximum size</strong><span>8 MB per image</span></p><p className="admin-images__side-note"><strong>Access</strong><span>Store administrators only</span></p></aside>
    </div>
  </section>;
}
