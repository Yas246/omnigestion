import { notFound } from 'next/navigation';
import { API_ORIGIN } from '@/lib/api/client';
import { StorefrontRenderer } from '@/components/storefront/StorefrontRenderer';
import type {
  StorefrontCompany,
  StorefrontConfig,
  StorefrontProduct,
} from '@/components/storefront/types';

interface StoreData {
  company: StorefrontCompany;
  config: StorefrontConfig;
  products: StorefrontProduct[];
}

/**
 * Public storefront (site vitrine) — server-rendered, no auth. Resolved by the
 * company's `store_slug`. Fetches the published config + published products
 * from the public API.
 */
export default async function StorePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let data: StoreData;
  try {
    const res = await fetch(
      `${API_ORIGIN}/api/v1/public/store/${encodeURIComponent(slug)}`,
      { cache: 'no-store' }
    );
    if (!res.ok) notFound();
    data = (await res.json()) as StoreData;
  } catch {
    notFound();
  }

  return <StorefrontRenderer company={data.company} config={data.config} products={data.products} />;
}
