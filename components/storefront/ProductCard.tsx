'use client';

import Image from 'next/image';
import { mediaUrl } from '@/lib/api/client';
import type { StorefrontProduct } from './types';

const fmt = (n: number, currency: string) => `${Number(n).toLocaleString('fr-FR')} ${currency}`;
const initials = (name: string) => name.trim().slice(0, 1).toUpperCase() || '·';
const dispFont = { fontFamily: 'var(--store-font-display)' } as React.CSSProperties;

export type ProductCardVariant = 'minimal' | 'boutique' | 'marche' | 'studio';

export function ProductCard({
  product,
  showPrice,
  currency,
  variant = 'minimal',
  index,
}: {
  product: StorefrontProduct;
  showPrice: boolean;
  currency: string;
  variant?: ProductCardVariant;
  index?: number;
}) {
  const img = mediaUrl(product.mainImageUrl);
  const accent = { color: 'var(--store-accent)' } as React.CSSProperties;
  // First card in a grid is prioritized so the LCP image loads eagerly.
  const priority = (index ?? 0) === 0;

  /**
   * Image, or an elegant monogram placeholder tinted with the brand palette —
   * never a bare "Pas d'image".
   *
   * Uses next/image with `fill` so we don't need to know the pixel dimensions
   * of remote media; the parent container carries the aspect ratio and the
   * image covers it (object-cover) exactly like the previous <img>.
   */
  const Visual = ({
    ratio,
    rounded = '',
    monogramWeight = 300,
  }: {
    ratio: string;
    rounded?: string;
    monogramWeight?: number;
  }) =>
    img ? (
      <div className={`relative ${ratio} ${rounded}`}>
        <Image
          src={img}
          alt={product.name}
          fill
          sizes="(max-width: 768px) 50vw, 25vw"
          priority={priority}
          className={`h-full w-full object-cover transition-transform duration-1000 ease-out group-hover:scale-105 ${rounded}`}
        />
      </div>
    ) : (
      <div
        className={`flex h-full w-full items-center justify-center ${ratio} ${rounded}`}
        style={{
          background:
            'linear-gradient(140deg, color-mix(in srgb, var(--store-primary) 16%, var(--store-bg)), color-mix(in srgb, var(--store-accent) 12%, var(--store-bg)))',
        }}
      >
        <span
          className="text-7xl"
          style={{ ...dispFont, fontWeight: monogramWeight, color: 'color-mix(in srgb, var(--store-text) 22%, transparent)' }}
        >
          {initials(product.name)}
        </span>
      </div>
    );

  // ===== MARCHÉ — warm, soft, rounded, image-forward =====
  if (variant === 'marche') {
    return (
      <article className="group flex flex-col">
        <div
          className="relative overflow-hidden rounded-3xl transition-transform duration-500 ease-out group-hover:-translate-y-1"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--store-text) 4%, transparent)',
            boxShadow: '0 1px 2px color-mix(in srgb, var(--store-text) 6%, transparent), 0 18px 40px -24px color-mix(in srgb, var(--store-primary) 45%, transparent)',
          }}
        >
          <Visual ratio="aspect-square" rounded="rounded-3xl" monogramWeight={600} />
          {/* little price flag, bottom-left, only if price shown */}
          {showPrice && (
            <span
              className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold backdrop-blur-sm"
              style={{ backgroundColor: 'color-mix(in srgb, var(--store-bg) 82%, transparent)', color: 'var(--store-text)' }}
            >
              <span style={accent}>●</span> {fmt(product.retailPrice, currency)}
            </span>
          )}
        </div>
        <div className="mt-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {product.category && (
              <span className="text-xs uppercase tracking-widest opacity-50">{product.category}</span>
            )}
            <h3 className="mt-1 truncate text-lg leading-tight" style={dispFont}>
              {product.name}
            </h3>
          </div>
          <span
            className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base transition-colors"
            style={{ backgroundColor: 'color-mix(in srgb, var(--store-accent) 14%, transparent)', color: 'var(--store-accent)' }}
            aria-hidden
          >
            →
          </span>
        </div>
      </article>
    );
  }

  // ===== STUDIO — film plate: index stamp, portrait, hairline caption =====
  if (variant === 'studio') {
    const mono = { fontFamily: 'var(--font-plex-mono), ui-monospace, monospace' } as React.CSSProperties;
    return (
      <article className="group flex flex-col">
        <div className="relative overflow-hidden rounded-md" style={{ backgroundColor: 'color-mix(in srgb, var(--store-text) 6%, transparent)' }}>
          <span
            className="absolute left-3 top-3 z-10 rounded-sm px-1.5 py-0.5 text-xs tracking-widest"
            style={{ backgroundColor: 'color-mix(in srgb, var(--store-bg) 72%, transparent)', ...mono }}
          >
            N°{String((index ?? 0) + 1).padStart(3, '0')}
          </span>
          <Visual ratio="aspect-3/4" rounded="rounded-md" monogramWeight={800} />
        </div>
        <div className="mt-3 flex items-baseline justify-between gap-3 border-t pt-3" style={{ borderColor: 'color-mix(in srgb, var(--store-text) 12%, transparent)' }}>
          <h3 className="truncate text-base leading-tight" style={dispFont}>
            {product.name}
          </h3>
          {showPrice && (
            <span className="shrink-0 text-sm font-medium tabular-nums" style={accent}>
              {Number(product.retailPrice).toLocaleString('fr-FR')}
            </span>
          )}
        </div>
        {product.category && (
          <span className="mt-1 text-xs uppercase tracking-widest opacity-40" style={mono}>
            {product.category}
          </span>
        )}
      </article>
    );
  }

  // ===== BOUTIQUE — lookbook card, caption BELOW image (not overlay) =====
  if (variant === 'boutique') {
    return (
      <article className="group flex flex-col">
        <div className="overflow-hidden" style={{ backgroundColor: 'color-mix(in srgb, var(--store-text) 5%, transparent)' }}>
          <Visual ratio="aspect-3/4" monogramWeight={400} />
        </div>
        <div className="mt-4 flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            {product.category && (
              <span className="text-xs uppercase tracking-eyebrow opacity-50">{product.category}</span>
            )}
            <h3 className="mt-1 truncate text-xl leading-tight" style={{ ...dispFont, fontWeight: 500 }}>
              {product.name}
            </h3>
          </div>
          {showPrice && (
            <span className="shrink-0 text-sm tracking-wide" style={accent}>
              {fmt(product.retailPrice, currency)}
            </span>
          )}
        </div>
      </article>
    );
  }

  // ===== MINIMAL — editorial tile (text below) =====
  return (
    <article className="group flex flex-col transition-all duration-500 hover:-translate-y-1">
      <div
        className="aspect-4/5 overflow-hidden rounded-sm"
        style={{ backgroundColor: 'color-mix(in srgb, var(--store-text) 5%, transparent)' }}
      >
        <Visual ratio="" monogramWeight={300} />
      </div>
      <div className="mt-3 flex flex-col gap-1">
        {product.category && (
          <span className="text-xs uppercase tracking-widest opacity-60">{product.category}</span>
        )}
        <h3 className="line-clamp-2 text-base leading-snug" style={dispFont}>
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
