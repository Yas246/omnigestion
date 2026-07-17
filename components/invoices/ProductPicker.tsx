'use client';

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useDebounce } from '@/lib/hooks/useDebounce';
import type { Product } from '@/types';

interface ProductPickerProps {
  products: Product[];
  onAdd: (productId: string) => void;
}

/**
 * Searchable product dropdown. Reusable across InvoiceDialog, PurchaseDialog, etc.
 */
export function ProductPicker({ products, onAdd }: ProductPickerProps) {
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    if (showDropdown) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showDropdown]);

  const filtered = products.filter((p) => {
    if (debouncedSearch.length > 0 && debouncedSearch.length < 3) return false;
    const match =
      !debouncedSearch ||
      p.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      p.code?.toLowerCase().includes(debouncedSearch.toLowerCase());
    return match && p.isActive;
  });

  return (
    <div className="flex gap-2">
      <div className="relative flex-1" ref={dropdownRef}>
        <Input
          placeholder="Rechercher un produit par nom ou code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setShowDropdown(true)}
        />
        {showDropdown && filtered.length > 0 && (
          <div className="absolute z-10 mt-1 max-h-96 w-full overflow-y-auto rounded-md border bg-background shadow-lg">
            {filtered.map((product) => (
              <div
                key={product.id}
                className="cursor-pointer px-3 py-2 hover:bg-muted"
                onClick={() => {
                  onAdd(product.id);
                  setSearch('');
                  setShowDropdown(false);
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-col">
                    <span className="font-medium">{product.name}</span>
                    {product.code && <span className="text-xs text-muted-foreground">{product.code}</span>}
                  </div>
                  <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                    {product.currentStock} {product.unit} — {product.retailPrice.toLocaleString()} FCFA
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Button type="button" size="icon" disabled={!search} onClick={() => filtered[0] && onAdd(filtered[0].id)}>
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
