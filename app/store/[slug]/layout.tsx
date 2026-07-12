import { StorefrontCartProvider } from '@/lib/storefront/cart-context';
import { BuyerProvider } from '@/lib/storefront/buyer-context';
import { FloatingCartButton } from '@/components/storefront/FloatingCartButton';

export default async function StoreLayout({
  params,
  children,
}: {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}) {
  const { slug } = await params;
  return (
    <BuyerProvider>
      <StorefrontCartProvider slug={slug}>
        {children}
        <FloatingCartButton slug={slug} />
      </StorefrontCartProvider>
    </BuyerProvider>
  );
}
