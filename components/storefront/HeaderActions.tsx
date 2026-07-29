'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ShoppingCart, User } from 'lucide-react';
import { useCart } from '@/lib/storefront/cart-context';
import { useBuyer } from '@/lib/storefront/buyer-context';
import { BuyerAuthModal } from './BuyerAuthModal';

/**
 * Cart + account actions, embedded inside each storefront template's header
 * (NOT floating). Inherits the header's text color (currentColor) and uses the
 * theme CSS vars for the cart badge so it matches every template.
 */
export function HeaderActions({ slug, className = '' }: { slug: string | null; className?: string }) {
  const { count } = useCart();
  const { buyer } = useBuyer();
  const [authOpen, setAuthOpen] = useState(false);
  const s = slug ?? '';

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {buyer ? (
        <Link href={`/store/${s}/account`} aria-label="Mon compte" className="opacity-70 transition-opacity hover:opacity-100">
          <User className="h-5 w-5" />
        </Link>
      ) : (
        <button onClick={() => setAuthOpen(true)} aria-label="Se connecter" className="opacity-70 transition-opacity hover:opacity-100">
          <User className="h-5 w-5" />
        </button>
      )}
      <Link href={`/store/${s}/cart`} aria-label="Panier" className="relative opacity-70 transition-opacity hover:opacity-100">
        <ShoppingCart className="h-5 w-5" />
        {count > 0 && (
          <span
            className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none"
            style={{ background: 'var(--store-primary, #111)', color: 'var(--store-bg, #fff)' }}
          >
            {count}
          </span>
        )}
      </Link>
      {!buyer && <BuyerAuthModal open={authOpen} onOpenChange={setAuthOpen} />}
    </div>
  );
}
