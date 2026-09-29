import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { lazy, Suspense, type ReactNode } from "react";
import StoreLayout from "./components/store/StoreLayout";
import { CartProvider } from "./contexts/CartContext";
import { WishlistProvider } from "./components/store/WishlistContext";

const Home = lazy(() => import("@/pages/StoreHome"));
const Shop = lazy(() => import("@/pages/Shop"));
const ProductDetail = lazy(() => import("@/pages/ProductDetail"));
const WishlistPage = lazy(() => import("@/pages/WishlistPage"));
const InfoPage = lazy(() => import("@/pages/InfoPage"));
const AdminProductImages = lazy(() => import("@/pages/AdminProductImages"));

function RouteFallback() {
  return <div className="min-h-[55vh] flex items-center justify-center text-sm text-[#667064]" role="status">Preparing your edit…</div>;
}

function StoreRoute({ children }: { children: ReactNode }) {
  return <StoreLayout><Suspense fallback={<RouteFallback />}>{children}</Suspense></StoreLayout>;
}

function AdminCatalogRoute() {
  return <StoreLayout><Suspense fallback={<RouteFallback />}><AdminProductImages /></Suspense></StoreLayout>;
}

function Router() {
  return (
    <CartProvider>
      <WishlistProvider>
        <Switch>
          <Route path="/" component={() => <StoreRoute><Home /></StoreRoute>} />
          <Route path="/shop" component={() => <StoreRoute><Shop /></StoreRoute>} />
          <Route path="/products/:handle">{params => <StoreRoute><ProductDetail handle={params.handle} /></StoreRoute>}</Route>
          <Route path="/admin/product-images" component={AdminCatalogRoute} />
          <Route path="/admin/catalog" component={AdminCatalogRoute} />
          <Route path="/wishlist" component={() => <StoreRoute><WishlistPage /></StoreRoute>} />
          <Route path="/account" component={() => <StoreRoute><InfoPage /></StoreRoute>} />
          <Route path="/pages/:slug" component={() => <StoreRoute><InfoPage /></StoreRoute>} />
          <Route path="/404" component={() => <StoreLayout><NotFound /></StoreLayout>} />
          <Route component={() => <StoreLayout><NotFound /></StoreLayout>} />
        </Switch>
      </WishlistProvider>
    </CartProvider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
