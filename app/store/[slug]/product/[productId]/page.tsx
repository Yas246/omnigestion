import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { API_ORIGIN } from '@/lib/api/client';
import { ProductDetail } from '@/components/storefront/ProductDetail';
import type { StorefrontCompany, StorefrontConfig, StorefrontProduct } from '@/components/storefront/types';

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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; productId: string }>;
}): Promise<Metadata> {
  const { slug, productId } = await params;
  try {
    const data = await fetchStore(slug);
    const product = data.products.find((p) => String(p.id) === productId);
    if (!product) return {};
    const title = product.name;
    const description = product.description || data.company.slogan || data.company.description || undefined;
    return { title, description };
  } catch {
    return {};
  }
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string; productId: string }>;
}) {
  const { slug, productId } = await params;

  let data: StoreData;
  try {
    data = await fetchStore(slug);
  } catch {
    notFound();
  }

  const product = data.products.find((p) => String(p.id) === productId);
  if (!product) notFound();

  return (
    <ProductDetail
      product={product}
      company={data.company}
      config={data.config}
      slug={slug}
      allProducts={data.products}
    />
  );
}
