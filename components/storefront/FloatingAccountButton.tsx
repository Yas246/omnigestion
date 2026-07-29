'use client';

import { useState } from 'react';
import Link from 'next/link';
import { User, LogIn } from 'lucide-react';
import { useBuyer } from '@/lib/storefront/buyer-context';
import { BuyerAuthModal } from '@/components/storefront/BuyerAuthModal';

/**
 * Always-visible buyer account access — top-right floating button on every
 * storefront page (home included), template-agnostic. Opens the login/signup
 * modal when logged out, links to the profile (/store/<slug>/account) when
 * logged in.
 */
export function FloatingAccountButton({ slug }: { slug: string }) {
  const { buyer } = useBuyer();
  const [authOpen, setAuthOpen] = useState(false);

  if (buyer) {
    return (
      <Link
        href={`/store/${slug}/account`}
        className="fixed right-4 top-4 z-40 flex items-center gap-2 rounded-full bg-gray-900/90 px-4 py-2 text-xs font-medium text-white shadow-lg backdrop-blur transition-transform hover:scale-105"
      >
        <User className="h-4 w-4" />
        <span className="max-w-[120px] truncate">{buyer.fullName || buyer.email}</span>
      </Link>
    );
  }

  return (
    <>
      <button
        onClick={() => setAuthOpen(true)}
        className="fixed right-4 top-4 z-40 flex items-center gap-2 rounded-full bg-gray-900/90 px-4 py-2 text-xs font-medium text-white shadow-lg backdrop-blur transition-transform hover:scale-105"
      >
        <LogIn className="h-4 w-4" />
        <span>Se connecter</span>
      </button>
      <BuyerAuthModal open={authOpen} onOpenChange={setAuthOpen} />
    </>
  );
}
