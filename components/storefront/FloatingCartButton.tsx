'use client';

import Link from 'next/link';
import { useCart } from '@/lib/storefront/cart-context';
import { ShoppingCart } from 'lucide-react';

export function FloatingCartButton({ slug }: { slug: string }) {
  const { count, total } = useCart();
  if (count === 0) return null;

  return (
    <Link
      href={`/store/${slug}/cart`}
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-gray-900 px-5 py-3 text-sm font-medium text-white shadow-lg transition-transform hover:scale-105"
    >
      <ShoppingCart className="h-5 w-5" />
      <span>{count} article{count > 1 ? 's' : ''}</span>
      <span className="ml-1 border-l border-white/30 pl-2">
        {total.toLocaleString('fr-FR')} FCFA
      </span>
    </Link>
  );
}
