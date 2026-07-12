'use client';

import { mediaUrl } from '@/lib/api/client';
import type { StorefrontProduct } from './types';

const fmt = (n: number, currency: string) => `${Number(n).toLocaleString('fr-FR')} ${currency}`;
const initials = (name: string) => name.trim().slice(0, 1).toUpperCase() || '·';

export function ProductCard({
  product,
  showPrice,
  currency,
  variant = 'minimal',
}: {
  product: StorefrontProduct;
  showPrice: boolean;
  currency: string;
  variant?: 'minimal' | 'boutique';
}) {
  const img = mediaUrl(product.mainImageUrl);
  const disp = { fontFamily: 'var(--store-font-display)' } as React.CSSProperties;
  const accent = { color: 'var(--store-accent)' } as React.CSSProperties;

  // Image (or an elegant monogram placeholder — never a bare "Pas d'image")
  const visual = (ratio: string) =>
    img ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={img}
        alt={product.name}
        className={`h-full w-full object-cover transition-transform duration-1000 ease-out group-hover:scale-105 ${ratio}`}
      />
    ) : (
      <div
        className="flex h-full w-full items-center justify-center"
        style={{
          background:
            'linear-gradient(140deg, color-mix(in srgb, var(--store-primary) 16%, var(--store-bg)), color-mix(in srgb, var(--store-accent) 10%, var(--store-bg)))',
        }}
      >
        <span
          className="text-7xl"
          style={{ ...disp, color: 'color-mix(in srgb, var(--store-text) 22%, transparent)' }}
        >
          {initials(product.name)}
        </span>
      </div>
    );

  if (variant === 'boutique') {
    return (
      <article
        className="group relative overflow-hidden rounded-sm"
        style={{ backgroundColor: 'color-mix(in srgb, var(--store-text) 6%, transparent)' }}
      >
        <div className="aspect-3/4 overflow-hidden">{visual('')}</div>
        <div
          className="absolute inset-x-0 bottom-0 p-4"
          style={{
            background:
              'linear-gradient(to top, color-mix(in srgb, var(--store-bg) 97%, transparent), color-mix(in srgb, var(--store-bg) 55%, transparent) 55%, transparent)',
          }}
        >
          <h3 className="truncate text-lg leading-tight" style={disp}>
            {product.name}
          </h3>
          {product.category && (
            <p className="mt-0.5 text-xs uppercase tracking-widest opacity-70">{product.category}</p>
          )}
          {showPrice && (
            <span className="mt-1.5 block text-sm font-medium" style={accent}>
              {fmt(product.retailPrice, currency)}
            </span>
          )}
        </div>
      </article>
    );
  }

  // Minimal — editorial tile
  return (
    <article className="group flex flex-col transition-all duration-500 hover:-translate-y-1">
      <div
        className="aspect-4/5 overflow-hidden rounded-sm"
        style={{ backgroundColor: 'color-mix(in srgb, var(--store-text) 5%, transparent)' }}
      >
        {visual('')}
      </div>
      <div className="mt-3 flex flex-col gap-1">
        {product.category && (
          <span className="text-xs uppercase tracking-widest opacity-60">{product.category}</span>
        )}
        <h3 className="line-clamp-2 text-base leading-snug" style={disp}>
          {product.name}
        </h3>
        {showPrice && (
          <span className="text-sm font-medium tracking-wide" style={accent}>
            {fmt(product.retailPrice, currency)}
          </span>
        )}
      </div>
    </article>
  );
}
