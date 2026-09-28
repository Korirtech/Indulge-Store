import { useEffect } from "react";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { Link, useRoute } from "wouter";

const content: Record<string, { title: string; lead: string; note: string }> = {
  about: { title: "A more considered way to shop.", lead: "Indulge Essentials is an independent, Kenya-first essentials store in the making—built around useful things, thoughtful choices, and the little rituals that make an ordinary day feel like your own.", note: "Our full story and confirmed product assortment will be added by the store team before launch." },
  shipping: { title: "Delivery, with the details to come.", lead: "We’re preparing a clear Kenya-wide delivery experience, starting with Nairobi and expanding thoughtfully.", note: "Delivery areas, fees, couriers and estimated dates are not yet configured. No delivery promise is being made on this preview." },
  returns: { title: "A fair, straightforward returns policy.", lead: "We want you to feel good about what you bring home. The final returns and refund policy is being prepared for launch.", note: "Eligibility windows, exclusions, replacement options and refund timing must be confirmed by the store owner before orders open." },
  contact: { title: "We’re getting customer care ready.", lead: "A helpful, responsive support experience is part of the Indulge Essentials promise.", note: "Store contact details and support hours have not been supplied yet. Please don’t send personal information through this preview." },
  faqs: { title: "Good questions deserve clear answers.", lead: "We’re assembling answers about products, ordering, payment and delivery as the store is prepared.", note: "Product ingredients, warranty details, payment methods and shipping terms will be published after owner approval." },
  privacy: { title: "Privacy matters here.", lead: "This preview uses Shopify’s commerce services and browser storage for the shopping bag and saved-item experience.", note: "The final privacy notice, analytics consent, data-retention period and customer rights process must be reviewed and published before launch." },
  terms: { title: "Terms for a store still taking shape.", lead: "The preview is not yet open for commercial orders. Product and service information shown here is illustrative until confirmed by the store owner.", note: "Final terms, consumer disclosures and governing-law details require owner review before accepting real orders." },
  account: { title: "Your account space is on the way.", lead: "Sign-in, saved products across devices, addresses and order history are planned for a later customer-account milestone.", note: "This first storefront preview keeps saved products in this browser. No account or order-management claim is being made yet." },
};

export default function InfoPage() {
  const [, params] = useRoute("/pages/:slug");
  const [, accountParams] = useRoute("/:slug");
  const slug = params?.slug || (accountParams?.slug === "account" ? "account" : "about");
  const page = content[slug] || { title: "This page is being prepared.", lead: "The Indulge Essentials store is still taking shape.", note: "Please check back once the store details have been confirmed." };
  useEffect(() => { document.title = `${page.title} — Indulge Essentials`; }, [page.title]);

  return <section className="info-page container"><div className="page-breadcrumb"><Link href="/">Home</Link><i>/</i><span>{slug.replaceAll("-", " ")}</span></div><div className="info-card"><span className="info-mark"><Sparkles size={21} /></span><p className="eyebrow">INDULGE ESSENTIALS</p><h1>{page.title}</h1><p className="info-lead">{page.lead}</p><div className="info-note">{page.note}</div><Link href="/" className="text-link"><ArrowLeft size={15} /> Back to the home edit</Link></div><div className="info-next"><span>Discover the current preview</span><Link href="/shop" className="button button--dark">Explore the edit <ArrowRight size={16} /></Link></div></section>;
}
