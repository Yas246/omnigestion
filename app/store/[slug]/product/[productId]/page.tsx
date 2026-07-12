import { notFound } from 'next/navigation';
import { API_ORIGIN } from '@/lib/api/client';
import { ProductDetail } from '@/components/storefront/ProductDetail';
import type { StorefrontCompany, StorefrontConfig, StorefrontProduct } from '@/components/storefront/types';

export const dynamic = 'force-dynamic';

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string; productId: string }>;
}) {
  const { slug, productId } = await params;

  let data: any;
  try {
    const res = await fetch(
      `${API_ORIGIN}/api/v1/public/store/${encodeURIComponent(slug)}`,
      { cache: 'no-store' }
    );
    if (!res.ok) notFound();
    data = await res.json();
  } catch {
    notFound();
  }

  const product = (data.products as StorefrontProduct[]).find(
    (p) => String(p.id) === productId
  );
  if (!product) notFound();

  return (
    <ProductDetail
      product={product}
      company={data.company as StorefrontCompany}
      config={data.config as StorefrontConfig}
      slug={slug}
      allProducts={data.products as StorefrontProduct[]}
    />
  );
}
