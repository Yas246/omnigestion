'use client';

import Link from 'next/link';
import { mediaUrl } from '@/lib/api/client';
import type { StorefrontCompany, StorefrontConfig, StorefrontProduct } from '../types';
import { ProductCard } from '../ProductCard';

const disp = { fontFamily: 'var(--store-font-display)' } as React.CSSProperties;
const mono = { fontFamily: 'var(--font-plex-mono), ui-monospace, monospace' } as React.CSSProperties;
const accent = { color: 'var(--store-accent)' } as React.CSSProperties;
const hairline = { borderColor: 'color-mix(in srgb, var(--store-text) 12%, transparent)' } as React.CSSProperties;

/**
 * STUDIO — the Dark Atelier. Cinematic, curated, record-store/creative-studio
 * energy — not corporate SaaS. Signature: a horizontal film-reel of products
 * (snap-scroll), an oversized left-aligned kinetic headline, a rotated INDEX
 * side-label, clean monospace stamps. No glow blobs, no glass nav, no "//".
 */
export function StudioTemplate({
  company,
  config,
  products,
}: {
  company: StorefrontCompany;
  config: StorefrontConfig;
  products: StorefrontProduct[];
}) {
  const enabled = config.sections.filter((s) => s.enabled);
  const showPrice = config.productDisplay.showPrice;
  const socials = Object.entries(config.footer.social ?? {}).filter(([, v]) => v);

  return (
    <div className="relative min-h-screen">
      {/* Top bar — clean hairline, wordmark + count stamp */}
      <header className="border-b" style={hairline}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5 sm:px-10">
          <div className="flex items-center gap-3">
            {company.logoUrl && <img src={mediaUrl(company.logoUrl) ?? ''} alt={company.name} className="h-7 w-7 object-contain" />}
            <span className="text-xl tracking-tight" style={{ ...disp, fontWeight: 700 }}>{company.name}</span>
          </div>
          <span className="text-xs uppercase tracking-widest opacity-50" style={mono}>
            Index · {String(products.length).padStart(2, '0')}
          </span>
        </div>
      </header>

      {/* Hero — kinetic type, rotated side label, accent rule */}
      {config.hero.enabled && (
        <section className="relative overflow-hidden">
          <span
            className="pointer-events-none absolute right-4 top-1/2 text-xs uppercase tracking-stamp opacity-30 sm:right-10"
            style={{ ...mono, writingMode: 'vertical-rl', transform: 'translateY(-50%) rotate(180deg)' }}
          >
            {config.hero.cta || 'Index'} — {company.name}
          </span>

          <div className="mx-auto max-w-6xl px-6 py-24 sm:px-10 sm:py-32">
            <div className="max-w-3xl">
              <div className="mb-6 flex items-center gap-3" style={mono}>
                <span className="inline-block h-px w-10" style={{ backgroundColor: 'var(--store-accent)' }} />
                <span className="text-xs uppercase tracking-stamp opacity-60">N°001 — Catalogue</span>
              </div>
              <h1
                className="text-balance leading-[0.88] tracking-tighter"
                style={{ ...disp, fontSize: 'clamp(3.5rem, 11vw, 9.5rem)', fontWeight: 800 }}
              >
                {config.hero.title || company.name}
              </h1>
              {config.hero.subtitle && (
                <p className="mt-8 max-w-md text-base opacity-60 sm:text-lg">{config.hero.subtitle}</p>
              )}
            </div>
          </div>
        </section>
      )}

      <div className="mx-auto max-w-6xl px-6 sm:px-10">
        {enabled.map((section) => {
          if (section.type === 'categories') {
            const cats = [...new Set(products.map((p) => p.category).filter(Boolean))];
            if (!cats.length) return null;
            return (
              <div key={section.type} className="flex flex-wrap gap-2 border-y py-4" style={hairline}>
                {cats.map((c) => (
                  <span key={c} className="rounded-sm px-3 py-1 text-xs uppercase tracking-widest opacity-60" style={{ ...mono, backgroundColor: 'color-mix(in srgb, var(--store-text) 6%, transparent)' }}>
                    {c}
                  </span>
                ))}
              </div>
            );
          }
          if (section.type === 'products') {
            return (
              <section key={section.type} className="py-12 sm:py-16">
                <div className="mb-8 flex items-end justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-stamp opacity-40" style={mono}>Sélection</p>
                    <h2 className="mt-2 tracking-tight" style={{ ...disp, fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 700 }}>
                      Le catalogue
                    </h2>
                  </div>
                  <span className="hidden items-center gap-2 text-xs uppercase tracking-widest opacity-40 sm:flex" style={mono}>
                    Glissez <span style={accent}>→</span>
                  </span>
                </div>

                {/* Film-reel — horizontal snap rail */}
                <div className="storefront-rail flex snap-x snap-mandatory gap-5 overflow-x-auto pb-6">
                  {products.map((p, i) => (
                    <Link
                      key={p.id}
                      href={`/store/${company.storeSlug}/product/${p.id}`}
                      className="snap-start shrink-0"
                      style={{ width: '16rem' }}
                    >
                      <ProductCard product={p} showPrice={showPrice} currency={company.currency} variant="studio" index={i} />
                    </Link>
                  ))}
                </div>

                {products.length === 0 && (
                  <p className="py-32 text-center text-sm opacity-30" style={mono}>Aucun article publié pour l'instant.</p>
                )}
              </section>
            );
          }
          if (section.type === 'about') {
            const aboutText = company.description || company.slogan;
            if (!aboutText) return null;
            return (
              <section key={section.type} className="grid gap-8 border-t py-20 md:grid-cols-[1fr_2fr]" style={hairline}>
                <div>
                  <p className="text-xs uppercase tracking-stamp opacity-40" style={mono}>À propos</p>
                  <h2 className="mt-2 text-3xl tracking-tight" style={{ ...disp, fontWeight: 700 }}>{company.name}</h2>
                </div>
                <p className="text-xl leading-relaxed opacity-80 md:border-l md:pl-10" style={{ borderColor: 'var(--store-accent)' }}>
                  {aboutText}
                </p>
              </section>
            );
          }
          if (section.type === 'contact') {
            const items: Array<[string, string | null]> = [
              ['Téléphone', company.phone],
              ['Email', company.email],
              ['Adresse', company.address],
            ].filter(([, v]) => v) as Array<[string, string | null]>;
            if (!items.length) return null;
            return (
              <section key={section.type} className="border-t py-16" style={hairline}>
                <p className="mb-8 text-xs uppercase tracking-stamp opacity-40" style={mono}>Contact</p>
                <div className="grid gap-px overflow-hidden rounded-lg border sm:grid-cols-3" style={hairline}>
                  {items.map(([label, val]) => (
                    <div key={label} className="p-6" style={{ backgroundColor: 'color-mix(in srgb, var(--store-text) 4%, transparent)' }}>
                      <p className="text-xs uppercase tracking-widest opacity-40" style={mono}>{label}</p>
                      <p className="mt-2 text-base font-medium wrap-break-word">{val}</p>
                    </div>
                  ))}
                </div>
              </section>
            );
          }
          return null;
        })}
      </div>

      {/* Footer — big wordmark, hairline */}
      <footer className="mt-10 border-t px-6 py-16 sm:px-10" style={hairline}>
        <div className="mx-auto max-w-6xl">
          <p className="tracking-tighter" style={{ ...disp, fontSize: 'clamp(2.5rem, 8vw, 5rem)', fontWeight: 800 }}>
            {company.name}
          </p>
          <div className="mt-8 flex flex-col gap-4 border-t pt-6 sm:flex-row sm:items-center sm:justify-between" style={hairline}>
            <span className="text-xs uppercase tracking-widest opacity-40" style={mono}>
              © {company.name}{config.footer.text ? ` — ${config.footer.text}` : ''}
            </span>
            {socials.length > 0 && (
              <div className="flex gap-5 text-xs uppercase tracking-widest opacity-50">
                {socials.map(([k]) => (
                  <span key={k} className="capitalize">{k}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
