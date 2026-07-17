'use client';

import Link from 'next/link';
import Image from 'next/image';
import { mediaUrl } from '@/lib/api/client';
import type { StorefrontCompany, StorefrontConfig, StorefrontProduct } from '../types';
import { ProductCard } from '../ProductCard';

const disp = { fontFamily: 'var(--store-font-display)' } as React.CSSProperties;
const accent = { color: 'var(--store-accent)' } as React.CSSProperties;
const softSurface = { backgroundColor: 'color-mix(in srgb, var(--store-text) 4%, transparent)' } as React.CSSProperties;
const softBorder = { borderColor: 'color-mix(in srgb, var(--store-text) 10%, transparent)' } as React.CSSProperties;
const fmt = (n: number, currency: string) => `${Number(n).toLocaleString('fr-FR')} ${currency}`;

/**
 * MARCHÉ — the Greenmarket. Warm, abundant, image-forward, the opposite of
 * brutalism: soft rounded surfaces, tinted shadows, a "Coup de cœur" featured
 * hero, pill category chips, friendly characterful type. Think a neighbourhood
 * market or a curated food/craft market — alive and approachable.
 */
export function MarcheTemplate({
  company,
  config,
  products,
}: {
  company: StorefrontCompany;
  config: StorefrontConfig;
  products: StorefrontProduct[];
}) {
  const enabled = config.sections.filter((s) => s.enabled);
  const cats = [...new Set(products.map((p) => p.category).filter(Boolean))];
  const showPrice = config.productDisplay.showPrice;
  const cols = config.productDisplay.columns ?? 3;
  const gridClass =
    cols >= 4
      ? 'grid-cols-2 lg:grid-cols-4'
      : 'grid-cols-2 lg:grid-cols-3';
  const socials = Object.entries(config.footer.social ?? {}).filter(([, v]) => v);
  // Only "feature" the first product in the hero when the hero is enabled —
  // but every product always appears in the stall grid (no false empty state).
  const featured = config.hero.enabled ? products[0] : undefined;

  return (
    <>
      {/* Header — friendly bar */}
      <header className="border-b" style={softBorder}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <div className="flex items-center gap-3">
            {company.logoUrl && (
              <Image
                src={mediaUrl(company.logoUrl) ?? ''}
                alt={company.name}
                width={36}
                height={36}
                className="h-9 w-9 rounded-xl object-contain"
                style={softSurface}
              />
            )}
            <span className="text-2xl tracking-tight sm:text-3xl" style={{ ...disp, fontWeight: 700 }}>{company.name}</span>
          </div>
          <span className="hidden rounded-full px-4 py-1.5 text-xs font-medium sm:inline" style={{ ...softSurface, color: 'var(--store-accent)' }}>
            ● {products.length} produit{products.length > 1 ? 's' : ''}
          </span>
        </div>
      </header>

      {/* Hero — warm welcome + featured "Coup de cœur" */}
      {config.hero.enabled && (
        <section className="mx-auto max-w-6xl px-5 pt-10 sm:px-8 sm:pt-16">
          <div className="grid items-center gap-8 lg:grid-cols-2">
            <div>
              {company.slogan && (
                <p className="mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium" style={{ ...softSurface, color: 'var(--store-accent)' }}>
                  ✦ {company.slogan}
                </p>
              )}
              <h1 className="text-balance leading-[0.95] tracking-tight" style={{ ...disp, fontSize: 'clamp(2.5rem, 6vw, 4.5rem)', fontWeight: 700 }}>
                {config.hero.title || `Le marché de ${company.name}`}
              </h1>
              {(config.hero.subtitle || company.description) && (
                <p className="mt-5 max-w-md text-base opacity-70 sm:text-lg">
                  {config.hero.subtitle || company.description}
                </p>
              )}
              {config.hero.cta && (
                <a
                  href="#etals"
                  className="mt-7 inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold transition-transform hover:scale-105"
                  style={{ backgroundColor: 'var(--store-primary)', color: 'var(--store-bg)' }}
                >
                  {config.hero.cta} <span>→</span>
                </a>
              )}
            </div>

            {/* Featured "Coup de cœur" card */}
            {featured && (
              <Link
                href={`/store/${company.storeSlug}/product/${featured.id}`}
                className="group overflow-hidden rounded-3xl border p-3 transition-transform duration-500 hover:-translate-y-1"
                style={{ ...softBorder, backgroundColor: 'var(--store-bg)', boxShadow: '0 30px 60px -40px color-mix(in srgb, var(--store-primary) 50%, transparent)' }}
              >
                <div className="relative aspect-4/3 overflow-hidden rounded-2xl" style={softSurface}>
                  {mediaUrl(featured.mainImageUrl) ? (
                    <Image
                      src={mediaUrl(featured.mainImageUrl) ?? ''}
                      alt={featured.name}
                      fill
                      priority
                      sizes="(max-width: 1024px) 100vw, 50vw"
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-8xl" style={{ ...disp, fontWeight: 700, color: 'color-mix(in srgb, var(--store-text) 18%, transparent)' }}>
                      {featured.name.charAt(0)}
                    </div>
                  )}
                  <span className="absolute left-4 top-4 rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: 'var(--store-accent)', color: 'var(--store-bg)' }}>
                    Coup de cœur
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 px-2 py-4">
                  <div className="min-w-0">
                    {featured.category && <span className="text-xs uppercase tracking-widest opacity-50">{featured.category}</span>}
                    <h2 className="truncate text-xl" style={{ ...disp, fontWeight: 600 }}>{featured.name}</h2>
                  </div>
                  {showPrice && <span className="shrink-0 text-lg font-semibold" style={accent}>{fmt(featured.retailPrice, company.currency)}</span>}
                </div>
              </Link>
            )}
          </div>
        </section>
      )}

      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        {/* Category chips */}
        {enabled.find((s) => s.type === 'categories') && cats.length > 0 && (
          <div className="storefront-rail flex gap-2.5 overflow-x-auto py-8 sm:py-10">
            {cats.map((c) => (
              <span key={c} className="whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-colors" style={softBorder}>
                {c}
              </span>
            ))}
          </div>
        )}

        {enabled.map((section) => {
          if (section.type === 'products') {
            return (
              <section key={section.type} id="etals" className="pb-16 pt-2 sm:pb-24">
                <div className="mb-8 flex items-end justify-between">
                  <h2 className="tracking-tight" style={{ ...disp, fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', fontWeight: 700 }}>
                    {cats.length > 1 ? 'Tous les étals' : 'Sur l\'étal'}
                  </h2>
                  <span className="text-sm opacity-50">{products.length} produit{products.length > 1 ? 's' : ''}</span>
                </div>

                <div className={`grid gap-6 sm:gap-8 ${gridClass}`}>
                  {products.map((p) => (
                    <Link key={p.id} href={`/store/${company.storeSlug}/product/${p.id}`}>
                      <ProductCard product={p} showPrice={showPrice} currency={company.currency} variant="marche" />
                    </Link>
                  ))}
                </div>

                {products.length === 0 && (
                  <div className="rounded-3xl border py-20 text-center" style={softBorder}>
                    <p className="text-xl" style={{ ...disp, fontWeight: 600 }}>L'étal se remplit bientôt ✦</p>
                    <p className="mt-2 text-sm opacity-60">Revenez dans quelques jours.</p>
                  </div>
                )}
              </section>
            );
          }
          if (section.type === 'about') {
            const aboutText = company.description || company.slogan;
            if (!aboutText) return null;
            return (
              <section key={section.type} className="pb-16 sm:pb-24">
                <div className="overflow-hidden rounded-3xl border p-8 sm:p-12" style={{ ...softBorder, backgroundColor: 'color-mix(in srgb, var(--store-accent) 8%, transparent)' }}>
                  <p className="mb-4 text-xs uppercase tracking-widest" style={accent}>Notre histoire</p>
                  <p className="max-w-2xl text-balance text-2xl leading-relaxed" style={{ ...disp, fontWeight: 500 }}>
                    {aboutText}
                  </p>
                </div>
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
              <section key={section.type} className="pb-16 sm:pb-24">
                <div className="grid gap-4 sm:grid-cols-3">
                  {items.map(([label, val]) => (
                    <div key={label} className="rounded-3xl border p-6" style={{ ...softBorder, backgroundColor: 'var(--store-bg)' }}>
                      <p className="text-xs uppercase tracking-widest opacity-50">{label}</p>
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

      {/* Footer — warm, friendly */}
      <footer className="border-t px-5 py-12 sm:px-8" style={{ ...softBorder, backgroundColor: 'color-mix(in srgb, var(--store-primary) 7%, transparent)' }}>
        <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xl" style={{ ...disp, fontWeight: 700 }}>{company.name}</p>
            <p className="mt-1 text-sm opacity-60">{company.slogan || config.footer.text || 'Merci de votre visite ✦'}</p>
          </div>
          {socials.length > 0 && (
            <div className="flex gap-4 text-sm capitalize opacity-70">
              {socials.map(([k]) => (
                <span key={k}>{k}</span>
              ))}
            </div>
          )}
        </div>
      </footer>
    </>
  );
}
