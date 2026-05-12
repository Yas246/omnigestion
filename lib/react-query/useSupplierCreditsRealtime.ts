'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/hooks/useAuth';
import { realtimeService } from '@/lib/services/RealtimeService';

export function useSupplierCreditsRealtime() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: credits = [], isLoading, error } = useQuery<any[]>({
    queryKey: ['companies', user?.currentCompanyId, 'supplierCredits'],
    queryFn: async () => [],
    enabled: !!user?.currentCompanyId,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (user?.currentCompanyId) {
      realtimeService.startSupplierCreditsListener(queryClient, user.currentCompanyId);
    }
  }, [user?.currentCompanyId, queryClient]);

  return {
    credits,
    isLoading,
    error,
  };
}
