'use client';

import Link from 'next/link';
import { toast } from 'sonner';
import { mediaUrl } from '@/lib/api/client';
import { useCart } from '@/lib/storefront/cart-context';
import { allFontsClass } from './fonts';
import { ProductReviews } from './ProductReviews';
import type { StorefrontCompany, StorefrontConfig, StorefrontProduct } from './types';
import { ArrowLeft, Check, ShoppingBag, Star, Minus, Plus } from 'lucide-react';
import { useState } from 'react';

interface Props {
  product: StorefrontProduct;
  company: StorefrontCompany;
  config: StorefrontConfig;
  slug: string;
  allProducts?: StorefrontProduct[];
}

export function ProductDetail({ product, company, config, slug, allProducts = [] }: Props) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);
  const [qty, setQty] = useState(1);
  const isBoutique = config.template === 'boutique';

  const { primary, accent, background, text } = config.colors;
  const disp = { fontFamily: isBoutique ? 'var(--font-cormorant)' : 'var(--font-fraunces)' } as React.CSSProperties;
  const body = { fontFamily: isBoutique ? 'var(--font-jost)' : 'var(--font-manrope)' } as React.CSSProperties;

  const style = {
    '--store-primary': primary,
    '--store-accent': accent,
    '--store-bg': background,
    '--store-text': text,
  } as React.CSSProperties;

  const img = mediaUrl(product.mainImageUrl);
  const fmtPrice = `${Number(product.retailPrice).toLocaleString('fr-FR')} ${company.currency}`;
  const gallery = product.images?.length > 0 ? product.images : [];

  const related = allProducts.filter((p) => p.id !== product.id && p.category === product.category).slice(0, 4);
  if (related.length === 0) {
    const others = allProducts.filter((p) => p.id !== product.id).slice(0, 4);
    related.push(...others);
  }

  const handleAdd = () => {
    add({ productId: product.id, name: product.name, price: product.retailPrice, image: product.mainImageUrl }, qty);
    setAdded(true);
    toast.success(`${qty} × ${product.name} ajouté${qty > 1 ? 's' : ''} au panier`);
    setTimeout(() => setAdded(false), 2500);
  };

  return (
    <div style={{ ...style, backgroundColor: background, color: text, ...body }} className={`${allFontsClass} min-h-screen antialiased`}>
      {/* Minimal header bar */}
      <header className="border-b" style={{ borderColor: 'color-mix(in srgb, var(--store-text) 12%, transparent)' }}>
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href={`/store/${slug}`} className="flex items-center gap-2 text-sm opacity-60 transition-opacity hover:opacity-100">
            <ArrowLeft className="h-4 w-4" /> {company.name}
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-10 sm:py-16">
        {/* Product layout */}
        <div className={`grid gap-8 sm:gap-12 ${isBoutique ? 'md:grid-cols-2' : 'md:grid-cols-[1.1fr_1fr]'}`}>
          {/* Visual */}
          <div className="space-y-3">
            <div
              className={`overflow-hidden rounded-sm ${isBoutique ? 'aspect-3/4' : 'aspect-square'}`}
              style={{ backgroundColor: 'color-mix(in srgb, var(--store-text) 5%, transparent)' }}
            >
              {img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img} alt={product.name} className="h-full w-full object-cover" />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center"
                  style={{
                    background: `linear-gradient(140deg, color-mix(in srgb, var(--store-primary) 16%, var(--store-bg)), color-mix(in srgb, var(--store-accent) 10%, var(--store-bg)))`,
                  }}
                >
                  <span className="text-8xl" style={{ ...disp, color: 'color-mix(in srgb, var(--store-text) 22%, transparent)' }}>
                    {product.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            {/* Gallery thumbnails */}
            {gallery.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {gallery.map((g) => (
                  <div key={g.id} className="h-16 w-16 shrink-0 overflow-hidden rounded-sm border" style={{ borderColor: 'color-mix(in srgb, var(--store-text) 10%, transparent)' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={mediaUrl(g.url) ?? ''} alt={g.alt ?? product.name} className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-col">
            {product.category && (
              <p className="mb-3 text-xs uppercase tracking-widest opacity-50">{product.category}</p>
            )}
            <h1 className="text-4xl leading-[1.1] tracking-tight sm:text-5xl" style={disp}>
              {product.name}
            </h1>
            {product.code && <p className="mt-2 text-sm opacity-40">Réf. {product.code}</p>}

            {/* Price */}
            <div className="mt-6 flex items-baseline gap-3">
              <span className="text-3xl font-semibold" style={{ color: 'var(--store-accent)' }}>{fmtPrice}</span>
              {product.unit && <span className="text-sm opacity-50">/ {product.unit}</span>}
            </div>

            {/* Description */}
            {product.description && (
              <div className="mt-8 border-t pt-6" style={{ borderColor: 'color-mix(in srgb, var(--store-text) 10%, transparent)' }}>
                <p className="text-base leading-relaxed opacity-80">{product.description}</p>
              </div>
            )}

            {/* Quantity + Add to cart */}
            <div className="mt-10 flex items-center gap-4">
              <div className="flex items-center rounded-sm border" style={{ borderColor: 'color-mix(in srgb, var(--store-text) 20%, transparent)' }}>
                <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="flex h-11 w-11 items-center justify-center transition-colors hover:bg-black/5">
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-10 text-center text-base font-medium">{qty}</span>
                <button type="button" onClick={() => setQty((q) => q + 1)} className="flex h-11 w-11 items-center justify-center transition-colors hover:bg-black/5">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <button
                type="button"
                onClick={handleAdd}
                className="flex flex-1 items-center justify-center gap-2 rounded-sm px-6 py-3.5 text-sm font-medium text-white shadow-sm transition-all hover:opacity-90 active:scale-[0.98]"
                style={{ backgroundColor: 'var(--store-primary)' }}
              >
                {added ? (
                  <><Check className="h-4 w-4" /> Ajouté au panier</>
                ) : (
                  <><ShoppingBag className="h-4 w-4" /> Ajouter — {(product.retailPrice * qty).toLocaleString('fr-FR')} {company.currency}</>
                )}
              </button>
            </div>

            {/* Stock hint */}
            {product.currentStock !== undefined && product.currentStock <= 5 && product.currentStock > 0 && (
              <p className="mt-4 text-sm" style={{ color: 'var(--store-accent)' }}>
                Plus que {product.currentStock} en stock — commandez vite !
              </p>
            )}

            {/* Trust badges */}
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 border-t pt-6 text-xs opacity-60" style={{ borderColor: 'color-mix(in srgb, var(--store-text) 10%, transparent)' }}>
              <span>✓ Paiement sécurisé</span>
              <span>✓ Livraison rapide</span>
              <span>✓ Satisfaction garantie</span>
            </div>
          </div>
        </div>

        {/* Reviews */}
        <ProductReviews slug={slug} productId={product.id} disp={disp} />

        {/* Related products */}
        {related.length > 0 && (
          <section className="mt-20 border-t pt-12" style={{ borderColor: 'color-mix(in srgb, var(--store-text) 10%, transparent)' }}>
            <div className="mb-8 flex items-center gap-4">
              <h2 className="text-2xl tracking-tight" style={disp}>Vous aimerez aussi</h2>
              <span className="h-px flex-1" style={{ backgroundColor: 'color-mix(in srgb, var(--store-text) 12%, transparent)' }} />
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-4">
              {related.map((rp) => {
                const rpImg = mediaUrl(rp.mainImageUrl);
                return (
                  <Link key={rp.id} href={`/store/${slug}/product/${rp.id}`} className="group">
                    <div
                      className={`mb-3 overflow-hidden rounded-sm ${isBoutique ? 'aspect-3/4' : 'aspect-square'}`}
                      style={{ backgroundColor: 'color-mix(in srgb, var(--store-text) 5%, transparent)' }}
                    >
                      {rpImg ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={rpImg} alt={rp.name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center" style={{ background: 'linear-gradient(140deg, color-mix(in srgb, var(--store-primary) 14%, var(--store-bg)), color-mix(in srgb, var(--store-accent) 8%, var(--store-bg)))' }}>
                          <span className="text-4xl" style={{ ...disp, color: 'color-mix(in srgb, var(--store-text) 20%, transparent)' }}>{rp.name.charAt(0).toUpperCase()}</span>
                        </div>
                      )}
                    </div>
                    <h3 className="truncate text-sm" style={disp}>{rp.name}</h3>
                    {config.productDisplay.showPrice && (
                      <p className="text-sm font-medium" style={{ color: 'var(--store-accent)' }}>
                        {Number(rp.retailPrice).toLocaleString('fr-FR')} {company.currency}
                      </p>
                    )}
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t px-6 py-8 text-center" style={{ borderColor: 'color-mix(in srgb, var(--store-text) 10%, transparent)' }}>
        <Link href={`/store/${slug}`} className="text-sm opacity-50 transition-opacity hover:opacity-100">
          ← Retour à {company.name}
        </Link>
      </footer>
    </div>
  );
}
