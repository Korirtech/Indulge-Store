import { describe, expect, it, vi } from "vitest";
import { readStoredValue, removeStoredValue, writeStoredValue } from "../client/src/lib/safe-storage";

describe("browser storage resilience", () => {
  it("reads values when storage is available", () => {
    expect(readStoredValue("cart", { getItem: key => key === "cart" ? "cart-1" : null })).toBe("cart-1");
  });

  it("treats storage access failures as unavailable storage", () => {
    expect(readStoredValue("cart", { getItem: () => { throw new Error("blocked"); } })).toBeNull();
  });

  it("does not let a denied write or removal break shopping", () => {
    const deniedStorage = {
      setItem: vi.fn(() => { throw new Error("quota exceeded"); }),
      removeItem: vi.fn(() => { throw new Error("blocked"); }),
    };

    expect(() => writeStoredValue("cart", "cart-1", deniedStorage)).not.toThrow();
    expect(() => removeStoredValue("cart", deniedStorage)).not.toThrow();
    expect(deniedStorage.setItem).toHaveBeenCalledWith("cart", "cart-1");
    expect(deniedStorage.removeItem).toHaveBeenCalledWith("cart");
  });
});
