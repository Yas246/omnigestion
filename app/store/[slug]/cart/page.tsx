'use client';

import { use, useState, useEffect } from 'react';
import { useCart } from '@/lib/storefront/cart-context';
import { useBuyer } from '@/lib/storefront/buyer-context';
import { BuyerAuthModal } from '@/components/storefront/BuyerAuthModal';
import { API_ORIGIN } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Trash2, Minus, Plus, ArrowLeft, ShoppingCart, Check, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { mediaUrl } from '@/lib/api/client';
import { allFontsClass } from '@/components/storefront/fonts';
import { resolveFonts } from '@/components/storefront/font-pairs';
import type { StorefrontConfig } from '@/components/storefront/types';

type Template = string | undefined;

const hairline = { borderColor: 'color-mix(in srgb, var(--store-text) 12%, transparent)' } as React.CSSProperties;

/** A single cart line — its shell changes with the storefront template. */
function CartLine({
  item,
  template,
  index,
  onQty,
  onRemove,
}: {
  item: { productId: number; name: string; price: number; quantity: number; image: string | null };
  template: Template;
  index: number;
  onQty: (id: number, qty: number) => void;
  onRemove: (id: number) => void;
}) {
  const isMarche = template === 'marche';
  const isStudio = template === 'studio';
  const isBoutique = template === 'boutique';
  const disp = { fontFamily: 'var(--store-font-display)' } as React.CSSProperties;
  const mono = { fontFamily: 'var(--font-plex-mono), ui-monospace, monospace' } as React.CSSProperties;
  const italic = { fontFamily: 'var(--store-font-display)', fontStyle: 'italic' } as React.CSSProperties;

  const thumb = (
    <div
      className={`h-14 w-14 shrink-0 overflow-hidden sm:h-16 sm:w-16 ${isMarche ? 'rounded-2xl' : isStudio ? 'rounded-md' : 'rounded-sm'}`}
      style={{ backgroundColor: 'color-mix(in srgb, var(--store-text) 5%, transparent)' }}
    >
      {mediaUrl(item.image) ? (
        <img src={mediaUrl(item.image) ?? ''} alt={item.name} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xl font-bold opacity-20 sm:text-2xl" style={isBoutique ? italic : disp}>
          {item.name.charAt(0)}
        </div>
      )}
    </div>
  );

  const nameEl = (
    <h3 className={`truncate text-sm sm:text-base ${isBoutique ? '' : 'font-medium'}`} style={isBoutique ? italic : disp}>
      {item.name}
    </h3>
  );

  const stepperBtn = 'flex items-center justify-center transition-colors';
  const stepper = (btnStyle: React.CSSProperties) => (
    <div className={`flex items-center ${isMarche ? 'rounded-full' : isStudio ? 'rounded-md' : 'rounded-full'} border`} style={hairline}>
      <button onClick={() => onQty(item.productId, item.quantity - 1)} className={`${stepperBtn} h-8 w-8 ${isMarche ? 'rounded-l-full' : isStudio ? 'rounded-l-md' : 'rounded-l-full'}`} style={btnStyle} aria-label="Diminuer">
        <Minus className="h-3 w-3" />
      </button>
      <span className="w-7 text-center text-sm font-medium tabular-nums" style={isBoutique ? italic : disp}>{item.quantity}</span>
      <button onClick={() => onQty(item.productId, item.quantity + 1)} className={`${stepperBtn} h-8 w-8 ${isMarche ? 'rounded-r-full' : isStudio ? 'rounded-r-md' : 'rounded-r-full'}`} style={btnStyle} aria-label="Augmenter">
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );

  const removeBtn = (
    <button onClick={() => onRemove(item.productId)} className="flex h-8 w-8 shrink-0 items-center justify-center opacity-40 transition-opacity hover:opacity-100" aria-label="Retirer">
      <Trash2 className="h-4 w-4" />
    </button>
  );

  // ===== MARCHÉ — soft rounded card =====
  if (isMarche) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-3xl border p-4 sm:flex-nowrap sm:gap-4" style={{ ...hairline, backgroundColor: 'var(--store-bg)' }}>
        {thumb}
        <div className="min-w-0 flex-1">
          {nameEl}
          <p className="text-xs opacity-60 sm:text-sm">{item.price.toLocaleString('fr-FR')} FCFA</p>
        </div>
        {stepper({ backgroundColor: 'color-mix(in srgb, var(--store-text) 3%, transparent)' })}
        <div className="w-full text-right sm:w-24 sm:shrink-0">
          <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--store-accent)' }}>{(item.price * item.quantity).toLocaleString('fr-FR')}</p>
          <p className="text-xs opacity-50">FCFA</p>
        </div>
        {removeBtn}
      </div>
    );
  }

  // ===== STUDIO — hairline card, mono stamp =====
  if (isStudio) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3 sm:flex-nowrap sm:gap-4" style={{ ...hairline, backgroundColor: 'var(--store-bg)' }}>
        <span className="hidden text-xs tabular-nums opacity-30 sm:inline" style={mono}>N°{String(index + 1).padStart(2, '0')}</span>
        {thumb}
        <div className="min-w-0 flex-1">
          {nameEl}
          <p className="text-xs opacity-50" style={mono}>{item.price.toLocaleString('fr-FR')} FCFA</p>
        </div>
        {stepper({})}
        <div className="w-full text-right sm:w-24 sm:shrink-0">
          <p className="font-medium tabular-nums" style={mono}>{(item.price * item.quantity).toLocaleString('fr-FR')}</p>
          <p className="text-xs opacity-50" style={mono}>FCFA</p>
        </div>
        {removeBtn}
      </div>
    );
  }

  // ===== BOUTIQUE — elegant card, italic serif =====
  if (isBoutique) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-sm border p-3 sm:flex-nowrap sm:gap-4" style={{ ...hairline, backgroundColor: 'var(--store-bg)' }}>
        {thumb}
        <div className="min-w-0 flex-1">
          {nameEl}
          <p className="text-xs opacity-50" style={italic}>{item.price.toLocaleString('fr-FR')} FCFA</p>
        </div>
        {stepper({})}
        <div className="w-full text-right sm:w-24 sm:shrink-0">
          <p className="text-base tabular-nums" style={italic}>{(item.price * item.quantity).toLocaleString('fr-FR')}</p>
          <p className="text-xs opacity-50">FCFA</p>
        </div>
        {removeBtn}
      </div>
    );
  }

  // ===== MINIMAL — flat hairline row (no card; the list divides rows) =====
  return (
    <div className="flex flex-wrap items-center gap-3 py-4 sm:flex-nowrap sm:gap-4">
      {thumb}
      <div className="min-w-0 flex-1">
        {nameEl}
        <p className="text-xs opacity-50 tabular-nums">{item.price.toLocaleString('fr-FR')} FCFA</p>
      </div>
      <div className={`flex items-center rounded-sm border`} style={hairline}>
        <button onClick={() => onQty(item.productId, item.quantity - 1)} className="flex h-8 w-8 items-center justify-center transition-colors hover:bg-black/5 rounded-l-sm" aria-label="Diminuer"><Minus className="h-3 w-3" /></button>
        <span className="w-7 text-center text-sm font-medium tabular-nums" style={disp}>{item.quantity}</span>
        <button onClick={() => onQty(item.productId, item.quantity + 1)} className="flex h-8 w-8 items-center justify-center transition-colors hover:bg-black/5 rounded-r-sm" aria-label="Augmenter"><Plus className="h-3 w-3" /></button>
      </div>
      <div className="w-full text-right sm:w-24 sm:shrink-0">
        <p className="font-medium tabular-nums" style={disp}>{(item.price * item.quantity).toLocaleString('fr-FR')}</p>
        <p className="text-xs opacity-50">FCFA</p>
      </div>
      {removeBtn}
    </div>
  );
}

export default function CartPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { items, updateQty, remove, total, count, clear } = useCart();
  const { buyer, authHeader, logout } = useBuyer();
  const [authOpen, setAuthOpen] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [ordered, setOrdered] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [config, setConfig] = useState<StorefrontConfig | null>(null);

  // Fetch storefront config for theming
  useEffect(() => {
    fetch(`${API_ORIGIN}/api/v1/public/store/${slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.config && setConfig(d.config))
      .catch(() => {});
  }, [slug]);

  const t = config?.template;
  const isMarche = t === 'marche';
  const isStudio = t === 'studio';
  const isBoutique = t === 'boutique';
  const isMinimal = !isMarche && !isStudio && !isBoutique;
  const primary = config?.colors.primary ?? '#4f46e5';
  const accent = config?.colors.accent ?? '#f59e0b';
  const bg = config?.colors.background ?? '#ffffff';
  const text = config?.colors.text ?? '#1f2937';
  const fonts = config ? resolveFonts(config) : null;
  const dispFont = fonts?.display;
  const bodyFont = fonts?.body;

  const themeStyle = {
    '--store-primary': primary,
    '--store-accent': accent,
    '--store-bg': bg,
    '--store-text': text,
    '--store-font-display': dispFont,
    '--store-font-body': bodyFont,
  } as React.CSSProperties;

  // Per-template shapes
  const totalShape = isMarche ? 'rounded-3xl' : isStudio ? 'rounded-lg' : isBoutique ? 'rounded-sm' : 'rounded-sm';
  const btnRadius = isStudio ? '0.5rem' : isMinimal ? '0.125rem' : '9999px';
  const itemBorder = { borderColor: `color-mix(in srgb, ${text} 12%, transparent)` } as React.CSSProperties;

  const handleCheckout = async () => {
    if (!buyer) {
      setAuthOpen(true);
      return;
    }
    setCheckingOut(true);
    try {
      const res = await fetch(`${API_ORIGIN}/api/v1/public/store/${slug}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })) }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Erreur');
      }
      const data = await res.json();
      setInvoiceNumber(data.invoice?.invoiceNumber ?? '');
      setOrdered(true);
      clear();
      toast.success('Commande passée');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCheckingOut(false);
    }
  };

  // ===== Success screen =====
  if (ordered) {
    return (
      <div style={{ ...themeStyle, backgroundColor: bg, color: text, fontFamily: bodyFont }} className={`${allFontsClass} flex min-h-screen flex-col items-center justify-center gap-6 px-4`}>
        <div className="flex h-20 w-20 items-center justify-center rounded-full" style={{ backgroundColor: `color-mix(in srgb, ${accent} 15%, transparent)` }}>
          <Check className="h-10 w-10" style={{ color: accent }} />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold" style={{ fontFamily: dispFont }}>Commande confirmée</h1>
          {invoiceNumber && <p className="mt-2 text-sm opacity-60">Référence : {invoiceNumber}</p>}
          <p className="mt-1 text-sm opacity-50">Le marchand va traiter votre commande.</p>
        </div>
        <Link href={`/store/${slug}`}>
          <Button variant="outline" style={{ borderColor: `color-mix(in srgb, ${text} 20%, transparent)`, color: text, borderRadius: btnRadius }}>
            Retour à la boutique
          </Button>
        </Link>
      </div>
    );
  }

  // ===== Empty cart =====
  if (count === 0) {
    return (
      <div style={{ ...themeStyle, backgroundColor: bg, color: text, fontFamily: bodyFont }} className={`${allFontsClass} flex min-h-screen flex-col items-center justify-center gap-4 px-4`}>
        <ShoppingCart className="h-16 w-16 opacity-20" />
        <h1 className="text-xl" style={{ fontFamily: dispFont }}>Votre panier est vide</h1>
        <Link href={`/store/${slug}`}>
          <Button variant="outline" style={{ borderColor: `color-mix(in srgb, ${text} 20%, transparent)`, color: text, borderRadius: btnRadius }}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Retour
          </Button>
        </Link>
      </div>
    );
  }

  // ===== Cart with items =====
  const listWrap = isMinimal ? 'divide-y' : 'space-y-3';

  return (
    <div style={{ ...themeStyle, backgroundColor: `color-mix(in srgb, ${bg} 97%, ${text} 3%)`, color: text, fontFamily: bodyFont }} className={`${allFontsClass} min-h-screen`}>
      <BuyerAuthModal open={authOpen} onOpenChange={setAuthOpen} onSuccess={handleCheckout} />
      <div className="mx-auto max-w-3xl px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl tracking-tight" style={{ fontFamily: dispFont }}>Mon panier ({count})</h1>
          <Link href={`/store/${slug}`}>
            <Button variant="ghost" size="sm" style={{ color: text }}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Continuer
            </Button>
          </Link>
        </div>

        {/* Items */}
        <div className={listWrap} style={isMinimal ? itemBorder : undefined}>
          {items.map((item, i) => (
            <CartLine key={item.productId} item={item} template={t} index={i} onQty={updateQty} onRemove={remove} />
          ))}
        </div>

        {/* Total */}
        <div className={`mt-6 flex items-center justify-between border p-4 ${totalShape}`} style={{ ...itemBorder, backgroundColor: bg }}>
          <span className="text-lg" style={{ fontFamily: dispFont }}>Total</span>
          <div className="text-right">
            <p className="text-2xl font-bold tabular-nums" style={{ color: accent }}>{total.toLocaleString('fr-FR')}</p>
            <p className="text-xs opacity-50">FCFA</p>
          </div>
        </div>

        {/* Buyer status */}
        <div className="mt-4 flex items-center justify-between text-sm opacity-70">
          {buyer ? (
            <>
              <span>
                Connecté : <strong>{buyer.fullName ?? buyer.email}</strong>
              </span>
              <button onClick={logout} className="underline hover:no-underline">
                Déconnexion
              </button>
            </>
          ) : (
            <span>Vous devrez vous connecter pour commander.</span>
          )}
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between">
          <Button variant="ghost" onClick={clear} style={{ color: text, borderRadius: btnRadius }} className="sm:order-1">
            <Trash2 className="mr-2 h-4 w-4" /> Vider
          </Button>
          <Button
            size="lg"
            onClick={handleCheckout}
            disabled={checkingOut}
            className="w-full sm:w-auto sm:order-2"
            style={{ backgroundColor: primary, color: bg, borderRadius: btnRadius }}
          >
            {checkingOut ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Traitement...
              </>
            ) : buyer ? (
              `Commander · ${total.toLocaleString('fr-FR')} FCFA`
            ) : (
              'Se connecter pour commander'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
