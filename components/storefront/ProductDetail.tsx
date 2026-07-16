'use client';

import Link from 'next/link';
import { toast } from 'sonner';
import { mediaUrl } from '@/lib/api/client';
import { useCart } from '@/lib/storefront/cart-context';
import { allFontsClass } from './fonts';
import { resolveFonts } from './font-pairs';
import { ProductReviews } from './ProductReviews';
import type { StorefrontCompany, StorefrontConfig, StorefrontProduct } from './types';
import { ArrowLeft, Check, ShoppingBag, Minus, Plus } from 'lucide-react';
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
  const isMarche = config.template === 'marche';
  const isStudio = config.template === 'studio';
  const isMinimal = !isBoutique && !isMarche && !isStudio;

  const fonts = resolveFonts(config);
  const disp = { fontFamily: 'var(--store-font-display)' } as React.CSSProperties;
  const mono = { fontFamily: 'var(--font-plex-mono), ui-monospace, monospace' } as React.CSSProperties;
  const italic = { fontFamily: 'var(--store-font-display)', fontStyle: 'italic' } as React.CSSProperties;

  const baseStyle = {
    '--store-primary': config.colors.primary,
    '--store-accent': config.colors.accent,
    '--store-bg': config.colors.background,
    '--store-text': config.colors.text,
    '--store-font-display': fonts.display,
    '--store-font-body': fonts.body,
  } as React.CSSProperties;

  const img = mediaUrl(product.mainImageUrl);
  const fmtPrice = `${Number(product.retailPrice).toLocaleString('fr-FR')} ${company.currency}`;
  const fmtTotal = `${(product.retailPrice * qty).toLocaleString('fr-FR')} ${company.currency}`;
  const inStock = product.currentStock != null && product.currentStock > 0;

  const related = allProducts.filter((p) => p.id !== product.id && p.category === product.category).slice(0, 4);
  if (related.length === 0) related.push(...allProducts.filter((p) => p.id !== product.id).slice(0, 4));

  const handleAdd = () => {
    add({ productId: product.id, name: product.name, price: product.retailPrice, image: product.mainImageUrl }, qty);
    setAdded(true);
    toast.success(`${qty} × ${product.name} ajouté${qty > 1 ? 's' : ''} au panier`);
    setTimeout(() => setAdded(false), 2500);
  };

  const accentColor = { color: 'var(--store-accent)' } as React.CSSProperties;
  const softSurface = { backgroundColor: 'color-mix(in srgb, var(--store-text) 4%, transparent)' } as React.CSSProperties;
  const hairline = { borderColor: 'color-mix(in srgb, var(--store-text) 10%, transparent)' } as React.CSSProperties;

  // ===== BOUTIQUE — editorial spread (centered magazine column) =====
  if (isBoutique) {
    return (
      <div style={{ ...baseStyle, backgroundColor: config.colors.background, color: config.colors.text }} className={`${allFontsClass} min-h-screen antialiased`}>
        <div className="mx-auto max-w-2xl px-6 py-10 sm:py-14">
          <Link href={`/store/${slug}`} className="mb-10 inline-flex items-center gap-2 text-base opacity-50 transition-opacity hover:opacity-100" style={italic}>
            <ArrowLeft className="h-4 w-4" /> Retour
          </Link>

          {/* Full-width portrait image */}
          <div className="overflow-hidden rounded-sm" style={softSurface}>
            {img ? (
              <img src={img} alt={product.name} className="aspect-3/4 h-full w-full object-cover" />
            ) : (
              <div className="flex aspect-3/4 h-full w-full items-center justify-center text-9xl" style={{ ...italic, color: 'color-mix(in srgb, var(--store-text) 20%, transparent)' }}>
                {product.name.charAt(0)}
              </div>
            )}
          </div>

          {/* Centered text block — magazine article */}
          <div className="mt-10 text-center">
            {product.category && <p className="text-xs uppercase tracking-stamp opacity-50" style={accentColor}>— {product.category} —</p>}
            <h1 className="mt-4 text-balance leading-tight tracking-tight" style={{ ...italic, fontSize: 'clamp(2.5rem, 6vw, 4.5rem)', fontWeight: 400 }}>
              {product.name}
            </h1>
            {product.code && <p className="mt-2 text-sm opacity-40" style={italic}>Réf. {product.code}</p>}

            {/* Price with flanking rules */}
            <div className="mt-6 flex items-center justify-center gap-4">
              <span className="h-px w-8" style={{ backgroundColor: 'color-mix(in srgb, var(--store-text) 20%, transparent)' }} />
              <span className="text-xl tracking-wide" style={{ ...italic, color: 'var(--store-accent)' }}>{fmtPrice}</span>
              <span className="h-px w-8" style={{ backgroundColor: 'color-mix(in srgb, var(--store-text) 20%, transparent)' }} />
            </div>

            {product.description && (
              <p className="mx-auto mt-8 max-w-xl text-balance text-lg leading-relaxed opacity-70" style={italic}>
                {product.description}
              </p>
            )}

            <div className="mt-10 flex items-center justify-center gap-4">
              <div className="flex rounded-full border" style={hairline}>
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="flex h-12 w-12 items-center justify-center rounded-full transition-colors hover:bg-black/5" aria-label="Diminuer"><Minus className="h-4 w-4" /></button>
                <span className="flex w-10 items-center justify-center text-lg" style={italic}>{qty}</span>
                <button onClick={() => setQty((q) => q + 1)} className="flex h-12 w-12 items-center justify-center rounded-full transition-colors hover:bg-black/5" aria-label="Augmenter"><Plus className="h-4 w-4" /></button>
              </div>
              <button onClick={handleAdd} className="flex items-center justify-center gap-2 rounded-full px-8 py-4 text-sm tracking-wide transition-opacity hover:opacity-90"
                style={{ backgroundColor: 'var(--store-primary)', color: 'var(--store-bg)' }}>
                {added ? <><Check className="h-4 w-4" /> Ajouté</> : <><ShoppingBag className="h-4 w-4" /> Ajouter au panier</>}
              </button>
            </div>
          </div>

          <ProductReviews slug={slug} productId={product.id} disp={{ ...italic, fontWeight: 400 }} />
        </div>
      </div>
    );
  }

  // ===== MARCHÉ — stall card (image top, warm overlapping card below) =====
  if (isMarche) {
    return (
      <div style={{ ...baseStyle, backgroundColor: config.colors.background, color: config.colors.text }} className={`${allFontsClass} min-h-screen antialiased`}>
        <div className="mx-auto max-w-3xl px-5 py-6 sm:px-8 sm:py-10">
          <Link href={`/store/${slug}`} className="mb-6 inline-flex items-center gap-2 text-sm font-medium opacity-60 transition-opacity hover:opacity-100">
            <ArrowLeft className="h-4 w-4" /> Retour à l'étal
          </Link>

          {/* Big image */}
          <div className="overflow-hidden rounded-3xl" style={softSurface}>
            {img ? (
              <img src={img} alt={product.name} className="aspect-4/3 h-full w-full object-cover" />
            ) : (
              <div className="flex aspect-4/3 h-full w-full items-center justify-center text-9xl" style={{ ...disp, fontWeight: 700, color: 'color-mix(in srgb, var(--store-text) 15%, transparent)' }}>
                {product.name.charAt(0)}
              </div>
            )}
          </div>

          {/* Warm card, pulled up to overlap the image */}
          <div className="relative -mt-8 rounded-3xl border p-6 sm:p-8" style={{ ...hairline, backgroundColor: 'var(--store-bg)', boxShadow: '0 30px 60px -40px color-mix(in srgb, var(--store-primary) 45%, transparent)' }}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                {product.category && (
                  <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium" style={{ ...softSurface, color: 'var(--store-accent)' }}>
                    ✦ {product.category}
                  </span>
                )}
                <h1 className="mt-3 text-balance text-3xl leading-tight tracking-tight sm:text-4xl" style={{ ...disp, fontWeight: 700 }}>{product.name}</h1>
              </div>
              <span className="shrink-0 text-2xl font-bold" style={accentColor}>{fmtPrice}</span>
            </div>

            {/* Badge row */}
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full px-3 py-1 text-xs font-medium" style={{ ...softSurface, color: inStock ? 'var(--store-accent)' : undefined, opacity: inStock ? 1 : 0.6 }}>
                {inStock ? `● En stock${product.currentStock ? ` (${product.currentStock})` : ''}` : '● Rupture'}
              </span>
              <span className="rounded-full px-3 py-1 text-xs font-medium" style={{ ...softSurface, color: 'var(--store-accent)' }}>✦ Livraison disponible</span>
            </div>

            {product.description && <p className="mt-5 text-base leading-relaxed opacity-70">{product.description}</p>}

            <div className="mt-7 flex items-center gap-3">
              <div className="flex items-center rounded-full border" style={hairline}>
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="flex h-12 w-12 items-center justify-center rounded-full transition-colors hover:bg-black/5" aria-label="Diminuer"><Minus className="h-4 w-4" /></button>
                <span className="w-10 text-center text-lg font-semibold tabular-nums" style={disp}>{qty}</span>
                <button onClick={() => setQty((q) => q + 1)} className="flex h-12 w-12 items-center justify-center rounded-full transition-colors hover:bg-black/5" aria-label="Augmenter"><Plus className="h-4 w-4" /></button>
              </div>
              <button onClick={handleAdd} className="flex flex-1 items-center justify-center gap-2 rounded-full px-6 py-4 text-sm font-semibold transition-transform hover:scale-105"
                style={{ backgroundColor: 'var(--store-primary)', color: 'var(--store-bg)' }}>
                {added ? <><Check className="h-4 w-4" /> Ajouté</> : <><ShoppingBag className="h-4 w-4" /> Ajouter — {fmtTotal}</>}
              </button>
            </div>
          </div>

          <div className="mt-12">
            <ProductReviews slug={slug} productId={product.id} disp={{ ...disp, fontWeight: 700 }} />
          </div>
        </div>
      </div>
    );
  }

  // ===== STUDIO — spec sheet (image + mono metadata sidebar) =====
  if (isStudio) {
    const specs: Array<[string, string]> = [
      ['RÉF', product.code || '—'],
      ['CATÉGORIE', product.category || '—'],
      ['UNITÉ', product.unit || '—'],
      ['STOCK', inStock ? `${product.currentStock} en stock` : 'Rupture'],
    ];
    return (
      <div style={{ ...baseStyle, backgroundColor: config.colors.background, color: config.colors.text }} className={`${allFontsClass} min-h-screen antialiased`}>
        <div className="mx-auto max-w-5xl px-6 py-8 sm:py-12">
          <Link href={`/store/${slug}`} className="mb-12 inline-flex items-center gap-3 text-xs uppercase tracking-stamp opacity-40 transition-opacity hover:opacity-80" style={mono}>
            <span className="inline-block h-px w-8" style={{ backgroundColor: 'var(--store-accent)' }} /> {company.name}
          </Link>

          <div className="grid gap-8 md:grid-cols-[3fr_2fr] md:gap-12">
            {/* Image plate */}
            <div className="overflow-hidden rounded-md" style={softSurface}>
              {img ? (
                <img src={img} alt={product.name} className="aspect-square h-full w-full object-cover" />
              ) : (
                <div className="flex aspect-square h-full w-full items-center justify-center text-9xl" style={{ ...disp, fontWeight: 800, color: 'color-mix(in srgb, var(--store-text) 12%, transparent)' }}>
                  {product.name.charAt(0)}
                </div>
              )}
            </div>

            {/* Spec sidebar */}
            <div className="flex flex-col">
              {product.category && (
                <p className="flex items-center gap-3 text-xs uppercase tracking-stamp opacity-50" style={mono}>
                  <span className="inline-block h-px w-8" style={{ backgroundColor: 'var(--store-accent)' }} /> {product.category}
                </p>
              )}
              <h1 className="mt-4 text-balance text-4xl leading-[0.92] tracking-tighter sm:text-5xl" style={{ ...disp, fontWeight: 800 }}>{product.name}</h1>
              <p className="mt-5 text-3xl font-bold" style={accentColor}>{fmtPrice}</p>

              {/* Spec list */}
              <div className="mt-6 border-t" style={hairline}>
                {specs.map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b py-2.5 text-sm" style={hairline}>
                    <span className="uppercase tracking-stamp opacity-40" style={mono}>{k}</span>
                    <span className="font-medium">{v}</span>
                  </div>
                ))}
              </div>

              {product.description && <p className="mt-6 border-l-2 pl-5 text-base leading-relaxed opacity-70" style={{ borderColor: 'var(--store-accent)' }}>{product.description}</p>}

              <div className="mt-8 flex items-center gap-3">
                <div className="flex rounded-lg border" style={hairline}>
                  <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="flex h-11 w-11 items-center justify-center transition-colors hover:bg-white/5" aria-label="Diminuer"><Minus className="h-4 w-4" /></button>
                  <span className="flex w-10 items-center justify-center text-base font-bold tabular-nums" style={disp}>{qty}</span>
                  <button onClick={() => setQty((q) => q + 1)} className="flex h-11 w-11 items-center justify-center transition-colors hover:bg-white/5" aria-label="Augmenter"><Plus className="h-4 w-4" /></button>
                </div>
                <button onClick={handleAdd} className="flex flex-1 items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold transition-transform hover:scale-105"
                  style={{ backgroundColor: 'var(--store-accent)', color: 'var(--store-bg)' }}>
                  {added ? <><Check className="h-4 w-4" /> Ajouté</> : <><ShoppingBag className="h-4 w-4" /> Ajouter — {fmtTotal}</>}
                </button>
              </div>
            </div>
          </div>

          <ProductReviews slug={slug} productId={product.id} disp={{ ...disp, fontWeight: 700 }} />
        </div>
      </div>
    );
  }

  // ===== MINIMAL — oversized type, text-forward =====
  return (
    <div style={{ ...baseStyle, backgroundColor: config.colors.background, color: config.colors.text }} className={`${allFontsClass} min-h-screen antialiased`}>
      <div className="mx-auto max-w-5xl px-6 py-8 sm:px-16 sm:py-12">
        <Link href={`/store/${slug}`} className="mb-16 inline-block text-sm opacity-50 transition-opacity hover:opacity-100" style={disp}>
          ← {company.name}
        </Link>

        <div className="grid gap-10 md:grid-cols-2">
          <div className="aspect-square overflow-hidden" style={softSurface}>
            {img ? (
              <img src={img} alt={product.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center" style={{ background: 'linear-gradient(140deg, color-mix(in srgb, var(--store-primary) 16%, var(--store-bg)), color-mix(in srgb, var(--store-accent) 10%, var(--store-bg)))' }}>
                <span className="text-9xl" style={{ ...disp, fontWeight: 300, color: 'color-mix(in srgb, var(--store-text) 22%, transparent)' }}>{product.name.charAt(0)}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col">
            {product.category && <p className="mb-3 text-xs uppercase tracking-widest opacity-40">{product.category}</p>}
            <h1 className="text-balance text-5xl leading-[0.95] tracking-tighter sm:text-7xl" style={{ ...disp, fontWeight: 300 }}>{product.name}</h1>
            <p className="mt-6 text-2xl font-light" style={accentColor}>{fmtPrice}</p>
            {product.description && <p className="mt-8 text-base leading-relaxed opacity-70">{product.description}</p>}

            <div className="mt-10 flex items-center gap-4">
              <div className="flex items-center gap-3">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="text-xl opacity-40 transition-opacity hover:opacity-100" aria-label="Diminuer">−</button>
                <span className="w-8 text-center text-xl tabular-nums" style={disp}>{qty}</span>
                <button onClick={() => setQty((q) => q + 1)} className="text-xl opacity-40 transition-opacity hover:opacity-100" aria-label="Augmenter">+</button>
              </div>
              <button onClick={handleAdd} className="border-b-2 pb-1 text-sm uppercase tracking-widest transition-opacity hover:opacity-60"
                style={{ borderColor: 'var(--store-accent)', color: 'var(--store-accent)' }}>
                {added ? 'Ajouté ✓' : 'Ajouter au panier'}
              </button>
            </div>
          </div>
        </div>

        <ProductReviews slug={slug} productId={product.id} disp={disp} />
      </div>
    </div>
  );
}
