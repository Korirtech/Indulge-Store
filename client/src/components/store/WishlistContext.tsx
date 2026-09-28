import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

const STORAGE_KEY = "indulge:wishlist:v1";

type WishlistValue = {
  ids: string[];
  ready: boolean;
  isSaved: (id: string) => boolean;
  toggle: (id: string) => void;
};

const WishlistContext = createContext<WishlistValue | null>(null);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.every(value => typeof value === "string")) {
          setIds(parsed);
        }
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (ready) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  }, [ids, ready]);

  const isSaved = useCallback((id: string) => ids.includes(id), [ids]);
  const toggle = useCallback((id: string) => {
    setIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  }, []);
  const value = useMemo(() => ({ ids, ready, isSaved, toggle }), [ids, ready, isSaved, toggle]);

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) throw new Error("useWishlist must be used within WishlistProvider");
  return context;
}
