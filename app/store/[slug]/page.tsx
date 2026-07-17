import type { Metadata } from 'next';
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

async function fetchStore(slug: string): Promise<StoreData> {
  const res = await fetch(
    `${API_ORIGIN}/api/v1/public/store/${encodeURIComponent(slug)}`,
    { next: { revalidate: 300 } }
  );
  if (!res.ok) notFound();
  return (await res.json()) as StoreData;
}

/**
 * Public storefront (site vitrine) — server-rendered, no auth. Resolved by the
 * company's `store_slug`. Fetches the published config + published products
 * from the public API. ISR-revalidated every 5 minutes.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const data = await fetchStore(slug);
    const { company } = data;
    return {
      title: company.name,
      description: company.slogan || company.description || undefined,
    };
  } catch {
    return {};
  }
}

export default async function StorePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let data: StoreData;
  try {
    data = await fetchStore(slug);
  } catch {
    notFound();
  }

  return <StorefrontRenderer company={data.company} config={data.config} products={data.products} />;
}
