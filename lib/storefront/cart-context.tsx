'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface CartItem {
  productId: number;
  name: string;
  price: number;
  image: string | null;
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  add: (item: Omit<CartItem, 'quantity'>, qty?: number) => void;
  remove: (productId: number) => void;
  updateQty: (productId: number, qty: number) => void;
  clear: () => void;
  total: number;
  count: number;
}

const CartContext = createContext<CartContextType | null>(null);

const STORAGE_PREFIX = 'storefront-cart-';

export function StorefrontCartProvider({
  slug,
  children,
}: {
  slug: string;
  children: React.ReactNode;
}) {
  const key = `${STORAGE_PREFIX}${slug}`;
  const [items, setItems] = useState<CartItem[]>([]);

  // Load from localStorage on mount.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) setItems(JSON.parse(stored));
    } catch {
      // ignore parse errors
    }
  }, [key]);

  // Persist on change.
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(items));
    } catch {
      // ignore quota errors
    }
  }, [items, key]);

  const add = useCallback((item: Omit<CartItem, 'quantity'>, qty = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === item.productId);
      if (existing) {
        return prev.map((i) =>
          i.productId === item.productId ? { ...i, quantity: i.quantity + qty } : i
        );
      }
      return [...prev, { ...item, quantity: qty }];
    });
  }, []);

  const remove = useCallback((productId: number) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }, []);

  const updateQty = useCallback((productId: number, qty: number) => {
    if (qty <= 0) {
      setItems((prev) => prev.filter((i) => i.productId !== productId));
      return;
    }
    setItems((prev) => prev.map((i) => (i.productId === productId ? { ...i, quantity: qty } : i)));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const count = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, add, remove, updateQty, clear, total, count }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within StorefrontCartProvider');
  return ctx;
}
