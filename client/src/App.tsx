import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { lazy, Suspense } from "react";
import Home from "./pages/StoreHome";
import Shop from "./pages/Shop";
import ProductDetail from "./pages/ProductDetail";
import WishlistPage from "./pages/WishlistPage";
import InfoPage from "@/pages/InfoPage";
import StoreLayout from "./components/store/StoreLayout";
import { CartProvider } from "./contexts/CartContext";
import { WishlistProvider } from "./components/store/WishlistContext";

const AdminProductImages = lazy(() => import("@/pages/AdminProductImages"));

function AdminCatalogRoute() {
  return (
    <StoreLayout>
      <Suspense fallback={<div className="min-h-[55vh] flex items-center justify-center text-sm text-[#667064]" role="status">Loading catalog dashboard…</div>}>
        <AdminProductImages />
      </Suspense>
    </StoreLayout>
  );
}

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <CartProvider>
      <WishlistProvider>
        <Switch>
          <Route path="/" component={() => <StoreLayout><Home /></StoreLayout>} />
          <Route path="/shop" component={() => <StoreLayout><Shop /></StoreLayout>} />
          <Route path="/products/:handle">{params => <StoreLayout><ProductDetail handle={params.handle} /></StoreLayout>}</Route>
          <Route path="/admin/product-images" component={AdminCatalogRoute} />
          <Route path="/admin/catalog" component={AdminCatalogRoute} />
          <Route path="/wishlist" component={() => <StoreLayout><WishlistPage /></StoreLayout>} />
          <Route path="/account" component={() => <StoreLayout><InfoPage /></StoreLayout>} />
          <Route path="/pages/:slug" component={() => <StoreLayout><InfoPage /></StoreLayout>} />
          <Route path="/404" component={() => <StoreLayout><NotFound /></StoreLayout>} />
          <Route component={() => <StoreLayout><NotFound /></StoreLayout>} />
        </Switch>
      </WishlistProvider>
    </CartProvider>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
