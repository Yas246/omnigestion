'use client';

import Link from 'next/link';
import type { StorefrontCompany, StorefrontConfig, StorefrontProduct } from '../types';

const disp = { fontFamily: 'var(--store-font-display)' } as React.CSSProperties;
const accent = { color: 'var(--store-accent)' } as React.CSSProperties;
const hairline = { borderColor: 'color-mix(in srgb, var(--store-text) 10%, transparent)' } as React.CSSProperties;
const rowBorder = { borderColor: 'color-mix(in srgb, var(--store-text) 8%, transparent)' } as React.CSSProperties;

/**
 * EXAGGERATED MINIMALISM — not a grid of cards. Products are a TEXT INDEX:
 * giant names, prices as the only accent, extreme whitespace. Think a gallery
 * wall with one word per line. Radically different from the other templates.
 */
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
  const socials = Object.entries(config.footer.social ?? {}).filter(([, v]) => v);

  return (
    <>
      {/* Header — just the name + a thin index count */}
      <header className="border-b" style={hairline}>
        <div className="flex items-baseline justify-between px-6 py-6 sm:px-16 sm:py-8">
          <span className="text-xl tracking-tight" style={disp}>{company.name}</span>
          <span className="text-xs uppercase tracking-widest opacity-30">{products.length} pièces</span>
        </div>
      </header>

      {/* Hero — oversized type, extreme negative space */}
      {config.hero.enabled && (
        <section className="px-6 py-28 sm:px-16 sm:py-44">
          {config.hero.subtitle && (
            <p className="mb-4 text-xs uppercase tracking-widest opacity-40">{config.hero.subtitle}</p>
          )}
          <h1
            className="text-balance leading-[0.9] tracking-tighter"
            style={{ ...disp, fontSize: 'clamp(3rem, 11vw, 9rem)', fontWeight: 300 }}
          >
            {config.hero.title || company.name}
          </h1>
          {config.hero.cta && (
            <a
              href="#collection"
              className="group mt-12 inline-flex items-center gap-3 text-sm uppercase tracking-widest"
              style={accent}
            >
              <span className="underline-offset-8 group-hover:underline">{config.hero.cta}</span>
              <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </a>
          )}
        </section>
      )}

      {/* Content */}
      <div className="px-6 sm:px-16">
        {enabled.map((section) => {
          if (section.type === 'products') {
            return (
              <section key={section.type} id="collection" className="py-12 sm:py-16">
                <p className="mb-10 text-xs uppercase tracking-widest opacity-30 sm:mb-16">Collection</p>
                {/* LIST — not a grid. One product per line, oversized name. */}
                <div className="divide-y" style={rowBorder}>
                  {products.map((p, i) => (
                    <Link
                      key={p.id}
                      href={`/store/${company.storeSlug}/product/${p.id}`}
                      className="group flex items-baseline justify-between gap-4 py-6 transition-all duration-500 hover:pl-5 sm:py-8"
                    >
                      <div className="flex min-w-0 items-baseline gap-4 sm:gap-8">
                        <span className="text-xs tabular-nums opacity-30 transition-opacity duration-300 group-hover:opacity-60">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <span
                          className="truncate text-2xl tracking-tight transition-all duration-300 group-hover:opacity-60 sm:text-4xl"
                          style={disp}
                        >
                          {p.name}
                        </span>
                        {p.category && (
                          <span className="hidden text-xs uppercase tracking-widest opacity-30 sm:inline">{p.category}</span>
                        )}
                      </div>
                      <div className="flex shrink-0 items-baseline gap-3">
                        {config.productDisplay.showPrice && (
                          <span
                            className="text-base font-light tabular-nums sm:text-xl"
                            style={accent}
                          >
                            {Number(p.retailPrice).toLocaleString('fr-FR')} {company.currency}
                          </span>
                        )}
                        <span className="text-lg opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100 -translate-x-2" style={accent}>
                          →
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
                {products.length === 0 && (
                  <p className="py-32 text-center text-sm opacity-30">Aucun produit publié pour le moment.</p>
                )}
              </section>
            );
          }
          if (section.type === 'categories') {
            const cats = [...new Set(products.map((p) => p.category).filter(Boolean))];
            if (cats.length === 0) return null;
            return (
              <section key={section.type} className="py-6">
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs uppercase tracking-widest opacity-40">
                  {cats.map((c, i) => (
                    <span key={c} className="flex items-center gap-6">
                      {i > 0 && <span style={accent}>·</span>}
                      {c}
                    </span>
                  ))}
                </div>
              </section>
            );
          }
          if (section.type === 'about') {
            const aboutText = company.description || company.slogan || '';
            if (!aboutText) return null;
            return (
              <section key={section.type} className="py-24 sm:py-32">
                <p className="mb-8 text-xs uppercase tracking-widest opacity-30">À propos</p>
                <p
                  className="max-w-2xl text-balance leading-relaxed"
                  style={{ ...disp, fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', fontWeight: 300 }}
                >
                  {aboutText}
                </p>
              </section>
            );
          }
          if (section.type === 'contact') {
            return (
              <section key={section.type} className="border-t py-16" style={hairline}>
                <p className="mb-8 text-xs uppercase tracking-widest opacity-30">Contact</p>
                <div className="space-y-1 text-sm">
                  {company.phone && <p>{company.phone}</p>}
                  {company.email && <p className="wrap-break-word">{company.email}</p>}
                  {company.address && <p className="opacity-60">{company.address}</p>}
                </div>
              </section>
            );
          }
          return null;
        })}
      </div>

      <footer className="border-t px-6 py-12 sm:px-16" style={hairline}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs uppercase tracking-widest opacity-30">
            © {company.name}{config.footer.text ? ` — ${config.footer.text}` : ''}
          </p>
          {socials.length > 0 && (
            <div className="flex gap-4 text-xs uppercase tracking-widest opacity-40">
              {socials.map(([k]) => (
                <span key={k} className="capitalize">{k}</span>
              ))}
            </div>
          )}
        </div>
      </footer>
    </>
  );
}
