'use client';

import Link from 'next/link';
import { mediaUrl } from '@/lib/api/client';
import type { StorefrontCompany, StorefrontConfig, StorefrontProduct } from '../types';
import { ProductCard } from '../ProductCard';

const disp = { fontFamily: 'var(--store-font-display)' } as React.CSSProperties;
const accent = { color: 'var(--store-accent)' } as React.CSSProperties;
const hairline = { borderColor: 'color-mix(in srgb, var(--store-text) 14%, transparent)' } as React.CSSProperties;

/** Tracked small-caps section label with a trailing hairline (editorial). */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-10 flex items-center gap-4">
      <span className="text-xs uppercase tracking-widest opacity-60">{children}</span>
      <span className="h-px flex-1" style={{ backgroundColor: 'color-mix(in srgb, var(--store-text) 14%, transparent)' }} />
    </div>
  );
}

export function MinimalTemplate({
  company,
  config,
  products,
}: {
  company: StorefrontCompany;
  config: StorefrontConfig;
  products: StorefrontProduct[];
}) {
  const enabled = config.sections.filter((s) => s.enabled);
  const cols = config.productDisplay.columns ?? 4;
  const gridClass =
    cols >= 4
      ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
      : 'grid-cols-2 sm:grid-cols-3';

  return (
    <>
      {/* Header — quiet wordmark + hairline */}
      <header className="border-b" style={hairline}>
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-5">
          {company.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mediaUrl(company.logoUrl) ?? ''}
              alt={company.name}
              className="h-9 w-9 rounded-sm object-contain"
            />
          )}
          <span className="text-xl tracking-tight" style={disp}>
            {company.name}
          </span>
        </div>
      </header>

      {/* Hero — editorial plate */}
      {config.hero.enabled && (
        <section className="px-6 py-24 text-center sm:py-32">
          <p className="text-xs uppercase tracking-widest" style={accent}>
            Boutique
          </p>
          <h1
            className="mx-auto mt-6 max-w-4xl text-5xl leading-[1.05] tracking-tight sm:text-7xl"
            style={disp}
          >
            {config.hero.title || company.name}
          </h1>
          {config.hero.subtitle && (
            <p className="mx-auto mt-6 max-w-xl text-base opacity-70 sm:text-lg">
              {config.hero.subtitle}
            </p>
          )}
          <span
            className="mx-auto mt-10 block h-px w-16"
            style={{ backgroundColor: 'var(--store-accent)' }}
          />
        </section>
      )}

      <div className="mx-auto max-w-6xl px-6">
        {enabled.map((section) => {
          if (section.type === 'categories') {
            const cats = [...new Set(products.map((p) => p.category).filter(Boolean))];
            if (cats.length === 0) return null;
            return (
              <section key={section.type} className="py-10">
                <div className="flex flex-wrap gap-3">
                  {cats.map((c) => (
                    <span
                      key={c}
                      className="rounded-full border px-4 py-1.5 text-xs uppercase tracking-widest opacity-80"
                      style={hairline}
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </section>
            );
          }
          if (section.type === 'products') {
            return (
              <section key={section.type} className="py-16">
                <SectionLabel>La collection</SectionLabel>
                <div className={`grid gap-x-6 gap-y-12 ${gridClass}`}>
                  {products.map((p) => (
                    <Link key={p.id} href={`/store/${company.storeSlug}/product/${p.id}`}>
                      <ProductCard
                        product={p}
                        showPrice={config.productDisplay.showPrice}
                        currency={company.currency}
                        variant="minimal"
                      />
                    </Link>
                  ))}
                </div>
                {products.length === 0 && (
                  <p className="py-12 text-center opacity-50">Aucun produit publié pour le moment.</p>
                )}
              </section>
            );
          }
          if (section.type === 'about') {
            return (
              <section key={section.type} className="py-20">
                <SectionLabel>À propos</SectionLabel>
                <p className="mx-auto max-w-2xl text-center text-xl leading-relaxed" style={disp}>
                  {company.description || company.slogan || `Bienvenue chez ${company.name}.`}
                </p>
              </section>
            );
          }
          if (section.type === 'contact') {
            return (
              <section key={section.type} className="border-t py-16" style={hairline}>
                <SectionLabel>Contact</SectionLabel>
                <div className="grid gap-8 sm:grid-cols-3">
                  {company.phone && (
                    <div>
                      <p className="text-xs uppercase tracking-widest opacity-50">Téléphone</p>
                      <p className="mt-2">{company.phone}</p>
                    </div>
                  )}
                  {company.email && (
                    <div>
                      <p className="text-xs uppercase tracking-widest opacity-50">Email</p>
                      <p className="mt-2 wrap-break-word">{company.email}</p>
                    </div>
                  )}
                  {company.address && (
                    <div>
                      <p className="text-xs uppercase tracking-widest opacity-50">Adresse</p>
                      <p className="mt-2">{company.address}</p>
                    </div>
                  )}
                </div>
              </section>
            );
          }
          return null;
        })}
      </div>

      {/* Footer */}
      <footer className="border-t px-6 py-12 text-center" style={hairline}>
        <p className="text-lg tracking-tight" style={disp}>
          {company.name}
        </p>
        <p className="mt-2 text-xs uppercase tracking-widest opacity-50">
          © {company.name}
          {config.footer.text ? ` — ${config.footer.text}` : ''}
        </p>
      </footer>
    </>
  );
}
