type StorageReader = Pick<Storage, "getItem">;
type StorageWriter = Pick<Storage, "setItem" | "removeItem">;

function browserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readStoredValue(key: string, storage: StorageReader | null = browserStorage()): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeStoredValue(key: string, value: string, storage: StorageWriter | null = browserStorage()): void {
  try {
    storage?.setItem(key, value);
  } catch {
    // Persistence is a convenience only; storage quota/privacy errors must not break shopping.
  }
}

export function removeStoredValue(key: string, storage: StorageWriter | null = browserStorage()): void {
  try {
    storage?.removeItem(key);
  } catch {
    // A stale persisted identifier can be ignored when browser storage is unavailable.
  }
}
