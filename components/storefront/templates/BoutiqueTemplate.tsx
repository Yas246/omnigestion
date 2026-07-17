'use client';

import Link from 'next/link';
import Image from 'next/image';
import { mediaUrl } from '@/lib/api/client';
import type { StorefrontCompany, StorefrontConfig, StorefrontProduct } from '../types';
import { ProductCard } from '../ProductCard';

const disp = { fontFamily: 'var(--store-font-display)' } as React.CSSProperties;
const italic = { fontFamily: 'var(--store-font-display)', fontStyle: 'italic' } as React.CSSProperties;
const accent = { color: 'var(--store-accent)' } as React.CSSProperties;
const hairline = { borderColor: 'color-mix(in srgb, var(--store-text) 16%, transparent)' } as React.CSSProperties;

/**
 * BOUTIQUE — the Lookbook / Maison. A fashion magazine, not a default theme:
 * editorial masthead with season/N°, full-bleed cover hero with italic serif,
 * a slow brand marquee, then a staggered alternating portrait grid (magazine
 * rhythm, not a flat grid), captioned cards, large italic statement.
 */
export function BoutiqueTemplate({
  company,
  config,
  products,
}: {
  company: StorefrontCompany;
  config: StorefrontConfig;
  products: StorefrontProduct[];
}) {
  const enabled = config.sections.filter((s) => s.enabled);
  const heroImg = mediaUrl(config.hero.image) ?? mediaUrl(company.bannerUrl);
  const cols = config.productDisplay.columns ?? 3;
  const gridClass =
    cols >= 4
      ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
      : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
  const socials = Object.entries(config.footer.social ?? {}).filter(([, v]) => v);
  const tagline = config.hero.subtitle || company.slogan || 'Nouvelle collection';

  return (
    <>
      {/* Masthead — hairline-divided, season/N° stamp */}
      <header className="border-b" style={hairline}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-xs uppercase tracking-eyebrow opacity-50">{tagline}</span>
          <span className="text-lg tracking-wide" style={disp}>{company.name}</span>
          <span className="text-xs uppercase tracking-eyebrow opacity-50">N°01</span>
        </div>
      </header>

      {/* Cover hero — full-bleed, italic serif over image, vertically centered */}
      {config.hero.enabled && (
        <section className="relative flex min-h-dvh items-center overflow-hidden">
          {heroImg ? (
            <Image
              src={heroImg}
              alt=""
              fill
              priority
              sizes="100vw"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(120% 90% at 15% 20%, color-mix(in srgb, var(--store-accent) 38%, transparent), transparent 55%), radial-gradient(120% 100% at 85% 80%, color-mix(in srgb, var(--store-primary) 52%, transparent), transparent 60%), var(--store-primary)',
              }}
            />
          )}
          {/* Flat veil tinted with the page bg → centered text stays readable on any image. */}
          <div className="absolute inset-0" style={{ backgroundColor: 'color-mix(in srgb, var(--store-bg) 45%, transparent)' }} />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, color-mix(in srgb, var(--store-bg) 60%, transparent), transparent 55%)' }} />

          <div className="relative w-full px-6 py-16 sm:px-12">
            <div className="mx-auto max-w-6xl">
              <p className="mb-4 text-xs uppercase tracking-stamp opacity-70" style={accent}>
                {config.hero.cta || '— La collection —'}
              </p>
              <h1
                className="max-w-3xl text-balance leading-[0.92] tracking-tight"
                style={{ ...italic, fontSize: 'clamp(3rem, 9vw, 8rem)', fontWeight: 400 }}
              >
                {config.hero.title || company.name}
              </h1>
            </div>
          </div>
        </section>
      )}

      {/* Brand marquee — slow editorial ticker */}
      <div className="overflow-hidden border-y py-4" style={{ ...hairline, backgroundColor: 'color-mix(in srgb, var(--store-primary) 8%, transparent)' }}>
        <div className="storefront-marquee flex w-max items-center whitespace-nowrap">
          {[0, 1].map((dup) => (
            <div key={dup} className="flex items-center" aria-hidden={dup === 1}>
              {Array.from({ length: 6 }).map((_, i) => (
                <span key={i} className="flex items-center">
                  <span className="px-6 text-2xl tracking-wide sm:text-3xl" style={italic}>
                    {company.name}
                  </span>
                  <span style={accent}>✦</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6">
        {enabled.map((section) => {
          if (section.type === 'products') {
            return (
              <section key={section.type} className="py-16 sm:py-24">
                <div className="mb-12 flex items-end justify-between sm:mb-16">
                  <div>
                    <p className="text-xs uppercase tracking-eyebrow opacity-50" style={accent}>Le lookbook</p>
                    <h2 className="mt-3 tracking-tight" style={{ ...disp, fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 400 }}>
                      La collection
                    </h2>
                  </div>
                  <span className="hidden text-xs uppercase tracking-eyebrow opacity-40 sm:block">
                    {products.length} pièces
                  </span>
                </div>

                {/* Staggered alternating grid — magazine rhythm */}
                <div className={`grid gap-x-6 gap-y-12 sm:gap-x-8 sm:gap-y-16 ${gridClass}`}>
                  {products.map((p, i) => (
                    <div key={p.id} className={i % 2 === 1 ? 'lg:mt-20' : ''}>
                      <Link href={`/store/${company.storeSlug}/product/${p.id}`}>
                        <ProductCard
                          product={p}
                          showPrice={config.productDisplay.showPrice}
                          currency={company.currency}
                          variant="boutique"
                        />
                      </Link>
                    </div>
                  ))}
                </div>
                {products.length === 0 && (
                  <div className="py-32 text-center">
                    <p className="text-2xl opacity-30" style={italic}>La collection arrive bientôt.</p>
                  </div>
                )}
              </section>
            );
          }
          if (section.type === 'categories') {
            const cats = [...new Set(products.map((p) => p.category).filter(Boolean))];
            if (!cats.length) return null;
            return (
              <section key={section.type} className="border-t py-8 text-center" style={hairline}>
                <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-base">
                  {cats.map((c, i) => (
                    <span key={c} className="flex items-center gap-8">
                      {i > 0 && <span style={accent}>✦</span>}
                      <span style={italic} className="opacity-70">{c}</span>
                    </span>
                  ))}
                </div>
              </section>
            );
          }
          if (section.type === 'about') {
            const aboutText = company.description || company.slogan;
            if (!aboutText) return null;
            return (
              <section key={section.type} className="py-24 text-center sm:py-32">
                <div className="mx-auto max-w-3xl">
                  <p className="mb-6 text-xs uppercase tracking-eyebrow opacity-40" style={accent}>La maison</p>
                  <p
                    className="text-balance leading-relaxed"
                    style={{ ...italic, fontSize: 'clamp(1.5rem, 3.5vw, 2.75rem)', fontWeight: 400 }}
                  >
                    {aboutText}
                  </p>
                  {company.logoUrl && (
                    <Image
                      src={mediaUrl(company.logoUrl) ?? ''}
                      alt={company.name}
                      width={120}
                      height={40}
                      className="mx-auto mt-10 h-10 w-auto object-contain opacity-70"
                    />
                  )}
                </div>
              </section>
            );
          }
          if (section.type === 'contact') {
            return (
              <section key={section.type} className="my-12 border-t py-16" style={hairline}>
                <div className="mb-10 text-center">
                  <p className="text-xs uppercase tracking-eyebrow opacity-40" style={accent}>Nous contacter</p>
                </div>
                <div className="grid gap-10 sm:grid-cols-3">
                  {company.phone && (
                    <div className="text-center">
                      <p className="text-xs uppercase tracking-eyebrow opacity-40">Téléphone</p>
                      <p className="mt-3 text-lg" style={italic}>{company.phone}</p>
                    </div>
                  )}
                  {company.email && (
                    <div className="text-center">
                      <p className="text-xs uppercase tracking-eyebrow opacity-40">Email</p>
                      <p className="mt-3 text-lg wrap-break-word" style={italic}>{company.email}</p>
                    </div>
                  )}
                  {company.address && (
                    <div className="text-center">
                      <p className="text-xs uppercase tracking-eyebrow opacity-40">Adresse</p>
                      <p className="mt-3 text-lg" style={italic}>{company.address}</p>
                    </div>
                  )}
                </div>
              </section>
            );
          }
          return null;
        })}
      </div>

      {/* Footer — rich editorial */}
      <footer className="px-6 py-16 text-white sm:px-12" style={{ backgroundColor: 'var(--store-primary)' }}>
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col items-center text-center">
            <p style={{ ...disp, fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 400 }}>{company.name}</p>
            <div className="mt-5 h-px w-16" style={{ backgroundColor: 'var(--store-accent)' }} />
            {socials.length > 0 && (
              <div className="mt-6 flex gap-6 text-xs uppercase tracking-eyebrow opacity-70">
                {socials.map(([k]) => (
                  <span key={k} className="capitalize">{k}</span>
                ))}
              </div>
            )}
            <p className="mt-6 text-xs uppercase tracking-eyebrow opacity-50">
              © {company.name}{config.footer.text ? ` — ${config.footer.text}` : ''}
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
