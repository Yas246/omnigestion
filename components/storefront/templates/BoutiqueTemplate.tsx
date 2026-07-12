'use client';

import Link from 'next/link';
import { mediaUrl } from '@/lib/api/client';
import type { StorefrontCompany, StorefrontConfig, StorefrontProduct } from '../types';
import { ProductCard } from '../ProductCard';

const disp = { fontFamily: 'var(--store-font-display)' } as React.CSSProperties;
const accent = { color: 'var(--store-accent)' } as React.CSSProperties;
const hairline = { borderColor: 'color-mix(in srgb, var(--store-text) 16%, transparent)' } as React.CSSProperties;

/** Centered editorial label with flanking hairlines (magazine style). */
function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-12 flex items-center justify-center gap-5">
      <span className="h-px w-12" style={{ backgroundColor: 'var(--store-accent)' }} />
      <span className="text-xs uppercase tracking-widest opacity-70">{children}</span>
      <span className="h-px w-12" style={{ backgroundColor: 'var(--store-accent)' }} />
    </div>
  );
}

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
      ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
      : 'grid-cols-2 sm:grid-cols-3';

  return (
    <>
      {/* Full-bleed hero */}
      <section className="relative flex h-screen min-h-130 items-center justify-center overflow-hidden">
        {heroImg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={heroImg} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at 15% 25%, color-mix(in srgb, var(--store-accent) 55%, transparent), transparent 55%), radial-gradient(circle at 85% 80%, color-mix(in srgb, var(--store-primary) 70%, transparent), transparent 60%), var(--store-primary)',
            }}
          />
        )}
        {/* contrast veil */}
        <div className="absolute inset-0 bg-black/35" />
        {/* wordmark */}
        <div className="absolute left-6 top-6 flex items-center gap-2 sm:left-10 sm:top-8">
          {company.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaUrl(company.logoUrl) ?? ''} alt={company.name} className="h-8 w-8 object-contain" />
          )}
          <span className="text-lg tracking-tight text-white" style={disp}>
            {company.name}
          </span>
        </div>
        {/* headline */}
        <div className="relative px-6 text-center text-white">
          <p className="text-xs uppercase tracking-widest opacity-80" style={accent}>
            {config.hero.cta || 'Maison'}
          </p>
          <h1
            className="mx-auto mt-5 max-w-4xl text-5xl leading-[1.02] tracking-tight sm:text-8xl"
            style={disp}
          >
            {config.hero.title || company.name}
          </h1>
          {config.hero.subtitle && (
            <p className="mx-auto mt-6 max-w-xl text-sm opacity-85 sm:text-base">{config.hero.subtitle}</p>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-6">
        {enabled.map((section) => {
          if (section.type === 'products') {
            return (
              <section key={section.type} className="py-20">
                <Label>La sélection</Label>
                <div className={`grid gap-x-6 gap-y-14 ${gridClass}`}>
                  {products.map((p) => (
                    <Link key={p.id} href={`/store/${company.storeSlug}/product/${p.id}`}>
                      <ProductCard
                        product={p}
                        showPrice={config.productDisplay.showPrice}
                        currency={company.currency}
                        variant="boutique"
                      />
                    </Link>
                  ))}
                </div>
                {products.length === 0 && (
                  <p className="py-16 text-center opacity-50">Aucun produit publié pour le moment.</p>
                )}
              </section>
            );
          }
          if (section.type === 'categories') {
            const cats = [...new Set(products.map((p) => p.category).filter(Boolean))];
            if (cats.length === 0) return null;
            return (
              <section key={section.type} className="pb-4 pt-16 text-center">
                <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs uppercase tracking-widest opacity-70">
                  {cats.map((c, i) => (
                    <span key={c} className="flex items-center gap-6">
                      {i > 0 && <span style={{ color: 'var(--store-accent)' }}>·</span>}
                      {c}
                    </span>
                  ))}
                </div>
              </section>
            );
          }
          if (section.type === 'about') {
            return (
              <section key={section.type} className="py-24">
                <Label>La maison</Label>
                <p className="mx-auto max-w-2xl text-center text-2xl leading-relaxed sm:text-3xl" style={disp}>
                  {company.description || company.slogan || `L'art de bien recevoir, selon ${company.name}.`}
                </p>
              </section>
            );
          }
          if (section.type === 'contact') {
            return (
              <section
                key={section.type}
                className="my-12 rounded-sm border px-6 py-16"
                style={hairline}
              >
                <Label>Nous contacter</Label>
                <div className="grid gap-10 sm:grid-cols-3">
                  {company.phone && (
                    <div className="text-center">
                      <p className="text-xs uppercase tracking-widest opacity-50">Téléphone</p>
                      <p className="mt-3 text-lg" style={disp}>
                        {company.phone}
                      </p>
                    </div>
                  )}
                  {company.email && (
                    <div className="text-center">
                      <p className="text-xs uppercase tracking-widest opacity-50">Email</p>
                      <p className="mt-3 text-lg wrap-break-word" style={disp}>
                        {company.email}
                      </p>
                    </div>
                  )}
                  {company.address && (
                    <div className="text-center">
                      <p className="text-xs uppercase tracking-widest opacity-50">Adresse</p>
                      <p className="mt-3 text-lg" style={disp}>
                        {company.address}
                      </p>
                    </div>
                  )}
                </div>
              </section>
            );
          }
          return null;
        })}
      </div>

      {/* Footer — contrast panel */}
      <footer className="px-6 py-16 text-center text-white" style={{ backgroundColor: 'var(--store-primary)' }}>
        <p className="text-2xl tracking-tight" style={disp}>
          {company.name}
        </p>
        <p className="mx-auto mt-3 max-w-md text-xs uppercase tracking-widest opacity-70">
          © {company.name}
          {config.footer.text ? ` — ${config.footer.text}` : ''}
        </p>
      </footer>
    </>
  );
}
