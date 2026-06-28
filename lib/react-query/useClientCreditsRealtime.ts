'use client';

import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/hooks/useAuth';
import { realtimeService } from '@/lib/services/RealtimeService';

export function useClientCreditsRealtime() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: credits = [], isLoading, error } = useQuery<any[]>({
    queryKey: ['companies', user?.currentCompanyId, 'clientCredits'],
    queryFn: async () => [],
    enabled: !!user?.currentCompanyId,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (user?.currentCompanyId) {
      realtimeService.startClientCreditsListener(queryClient, user.currentCompanyId);
    }
  }, [user?.currentCompanyId, queryClient]);

  const payments = useMemo(() => {
    return credits.flatMap((c: any) => (c.payments || []));
  }, [credits]);

  return {
    credits,
    payments,
    isLoading,
    error,
  };
}
