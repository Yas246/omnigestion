'use client';

import { useState } from 'react';
import {
  FormField,
  FormItem,
  FormLabel,
  FormDescription,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useDebounce } from '@/lib/hooks/useDebounce';
import type { Client } from '@/types';
import type { Control } from 'react-hook-form';

interface ClientPickerProps {
  clients: Client[];
  control: Control<any>;
  name?: string;
}

/**
 * Searchable client dropdown. Reusable across InvoiceDialog, PurchaseDialog.
 */
export function ClientPicker({ clients, control, name = 'clientId' }: ClientPickerProps) {
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const debouncedSearch = useDebounce(search, 300);

  const filtered = clients.filter((c) => {
    if (debouncedSearch.length > 0 && debouncedSearch.length < 3) return false;
    return (
      !debouncedSearch ||
      c.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      c.phone?.includes(debouncedSearch)
    );
  });

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="flex flex-col gap-0">
          <FormLabel>Client (optionnel)</FormLabel>
          <div className="relative">
            <Input
              placeholder="Rechercher un client par nom ou téléphone... (min. 3 caractères)"
              value={search}
              onChange={(e) => {
                const v = e.target.value;
                setSearch(v);
                setShowDropdown(true);
                if (!v) field.onChange(undefined);
              }}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
            />
            {showDropdown && debouncedSearch && filtered.length > 0 && (
              <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border bg-background shadow-lg">
                {filtered.map((client) => (
                  <div
                    key={client.id}
                    className="flex cursor-pointer flex-col px-3 py-2 hover:bg-muted"
                    onPointerDown={() => {
                      field.onChange(client.id);
                      setSearch(client.name);
                      setShowDropdown(false);
                    }}
                  >
                    <span className="font-medium">{client.name}</span>
                    {client.phone && <span className="text-xs text-muted-foreground">{client.phone}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
          <FormDescription>
            {field.value
              ? `Client sélectionné: ${clients.find((c) => c.id === field.value)?.name}`
              : 'Laissez vide pour un client de passage'}
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
