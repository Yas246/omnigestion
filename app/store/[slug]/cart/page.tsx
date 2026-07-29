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
async function fetchStore(slug: string): Promise<{ config: StorefrontConfig | null; companyName: string | null }> {
  try {
    const res = await fetch(
      `${API_ORIGIN}/api/v1/public/store/${encodeURIComponent(slug)}`,
      { next: { revalidate: 300 } },
    );
    if (!res.ok) return { config: null, companyName: null };
    const data = await res.json();
    return { config: (data?.config as StorefrontConfig) ?? null, companyName: data?.company?.name ?? null };
  } catch {
    return { config: null, companyName: null };
  }
}

export default async function CartPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { config, companyName } = await fetchStore(slug);
  return <CartClient slug={slug} config={config} companyName={companyName} />;
}
