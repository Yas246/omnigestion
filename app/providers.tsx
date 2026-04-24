'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, type ReactNode } from 'react';
import { useConnectionRecovery } from '@/lib/hooks/useConnectionRecovery';

function ConnectionRecovery() {
  useConnectionRecovery();
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Conserver les données en cache indéfiniment (géré par onSnapshot)
            staleTime: Infinity,
            // Garde les données en cache pendant 30 minutes
            gcTime: 30 * 60 * 1000,
            // Ne PAS recharger au mount si les données sont en cache
            refetchOnMount: false,
            // Ne PAS recharger quand le réseau revient (les données sont gérées par onSnapshot)
            refetchOnReconnect: false,
            // Ne PAS recharger au focus de la fenêtre
            refetchOnWindowFocus: false,
            // Nombre de tentatives de retry
            retry: 1,
          },
          mutations: {
            // Rollback automatique en cas d'erreur
            onError: (error) => {
              console.error('Mutation error:', error);
            },
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ConnectionRecovery />
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
