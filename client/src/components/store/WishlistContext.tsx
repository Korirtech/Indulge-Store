import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { readStoredValue, removeStoredValue, writeStoredValue } from "@/lib/safe-storage";

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
    const saved = readStoredValue(STORAGE_KEY);
    if (saved) {
      try {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.every(value => typeof value === "string")) {
          setIds(parsed);
        }
      } catch {
        removeStoredValue(STORAGE_KEY);
      }
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) writeStoredValue(STORAGE_KEY, JSON.stringify(ids));
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
