'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProtectedPageProps {
  module: string;
  action: 'read' | 'create' | 'update' | 'delete';
  children: React.ReactNode;
}

/**
 * Composant pour protéger une page complète
 * Redirige vers le dashboard si l'utilisateur n'a pas la permission requise
 *
 * @example
 * <ProtectedPage module="sales" action="create">
 *   <SalesPage />
 * </ProtectedPage>
 */
export function ProtectedPage({ module, action = 'read', children }: ProtectedPageProps) {
  const router = useRouter();
  const { hasPermission, isAdmin, getFirstAccessiblePage } = usePermissions();
  const hasAccess = isAdmin || hasPermission(module, action);
  const firstAccessiblePage = getFirstAccessiblePage();

  useEffect(() => {
    if (!hasAccess) {
      // Rediriger vers la première page accessible après un court délai
      const timer = setTimeout(() => {
        router.push(firstAccessiblePage);
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [hasAccess, router, firstAccessiblePage]);

  // Afficher un état de chargement pendant la vérification
  if (!hasAccess) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
        <div className="text-center space-y-4 max-w-md">
          <div className="flex justify-center">
            <AlertCircle className="h-12 w-12 text-destructive" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold">Accès non autorisé</h1>
            <p className="text-muted-foreground">
              Vous n'avez pas la permission requise pour accéder à cette page.
            </p>
            <p className="text-sm text-muted-foreground">
              Module: <span className="font-medium">{module}</span> |
              Action: <span className="font-medium">{action}</span>
            </p>
          </div>
          <Button onClick={() => router.push(firstAccessiblePage)}>
            Retour à l'accueil
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * Composant simplifié pour protéger une page avec vérification de lecture seule
 */
interface ProtectedPageReadProps {
  module: string;
  children: React.ReactNode;
}

export function ProtectedPageRead({ module, children }: ProtectedPageReadProps) {
  return <ProtectedPage module={module} action="read">{children}</ProtectedPage>;
}
