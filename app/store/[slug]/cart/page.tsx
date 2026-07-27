import { API_ORIGIN } from '@/lib/api/client';
import { CartClient } from './cart-client';
import type { StorefrontConfig } from '@/components/storefront/types';

/**
 * Cart checkout — SERVER entry. Fetches the storefront config server-side (same
 * ISR window as the vitrine page) and hands it to the client <CartClient> as a
 * prop, so the theme/colors/fonts are present on the FIRST paint (no flash).
 * Previously this was a single client component that fetched config on mount →
 * visible theme flash on arrival.
 */
async function fetchConfig(slug: string): Promise<StorefrontConfig | null> {
  try {
    const res = await fetch(
      `${API_ORIGIN}/api/v1/public/store/${encodeURIComponent(slug)}`,
      { next: { revalidate: 300 } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return (data?.config as StorefrontConfig) ?? null;
  } catch {
    return null;
  }
}

export default async function CartPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const config = await fetchConfig(slug);
  return <CartClient slug={slug} config={config} />;
}
