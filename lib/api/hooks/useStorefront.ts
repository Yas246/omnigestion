'use client';

/**
 * Storefront (site vitrine) config — API-backed.
 *  - useStorefront() -> { storefront, isLoading, save, publish, setSlug, setEnabled }
 * `storefront.config` is the DRAFT being edited; publish copies it to published.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { StorefrontConfig } from '@/components/storefront/types';

export interface StorefrontResponse {
  id: number;
  template: string;
  config: StorefrontConfig;
  publishedConfig: StorefrontConfig | null;
  publishedAt: string | null;
  slug: string | null;
  enabled: boolean;
  companyName: string | null;
  slogan: string | null;
  description: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
}

const KEY = ['storefront'] as const;

export function useStorefront() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: KEY });

  const q = useQuery({
    queryKey: KEY,
    queryFn: async () => api.get<StorefrontResponse>('/storefront'),
  });

  const saveMutation = useMutation({
    mutationFn: async (data: { template?: string; config?: StorefrontConfig }) =>
      api.put('/storefront', data),
    onSuccess: invalidate,
  });
  const publishMutation = useMutation({
    mutationFn: async () => api.post('/storefront/publish'),
    onSuccess: invalidate,
  });
  const slugMutation = useMutation({
    mutationFn: async (slug: string) => api.patch('/storefront/slug', { slug }),
    onSuccess: invalidate,
  });
  const enabledMutation = useMutation({
    mutationFn: async (enabled: boolean) => api.patch('/storefront/enabled', { enabled }),
    onSuccess: invalidate,
  });

  return {
    storefront: q.data,
    isLoading: q.isLoading,
    save: (data: { template?: string; config?: StorefrontConfig }) =>
      saveMutation.mutateAsync(data),
    publish: () => publishMutation.mutateAsync(),
    setSlug: (slug: string) => slugMutation.mutateAsync(slug),
    setEnabled: (enabled: boolean) => enabledMutation.mutateAsync(enabled),
  };
}
