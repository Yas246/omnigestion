'use client';

import { ReactNode } from 'react';
import { usePermissions } from '@/lib/hooks/usePermissions';

interface PermissionGateProps {
  module: string;
  action: string;
  /**
   * Mode de contrôle d'accès
   * - 'hide': masque l'élément si pas de permission (défaut)
   * - 'disable': désactive l'élément mais l'affiche
   * - 'error': affiche un message d'erreur à la place
   */
  fallback?: 'hide' | 'disable' | 'error';
  fallbackMessage?: string;
  children: ReactNode;
  /**
   * Fonction de rendu personnalisé quand pas de permission
   * SurchARGE fallback si fourni
   */
  renderNoAccess?: () => ReactNode;
}

/**
 * Composant pour conditionner l'affichage/accès en fonction des permissions
 *
 * @example
 * // Mode par défaut (masquer si pas de permission)
 * <PermissionGate module="sales" action="create">
 *   <Button>Créer une facture</Button>
 * </PermissionGate>
 *
 * @example
 * // Mode disable (garder visible mais désactivé)
 * <PermissionGate module="sales" action="delete" fallback="disable">
 *   <Button>Supprimer</Button>
 * </PermissionGate>
 *
 * @example
 * // Mode error (afficher un message)
 * <PermissionGate module="settings" action="update" fallback="error">
 *   <Button>Modifier les paramètres</Button>
 * </PermissionGate>
 *
 * @example
 * // Rendu personnalisé
 * <PermissionGate
 *   module="sales"
 *   action="update"
 *   renderNoAccess={() => <div>Vous n'avez pas les droits</div>}
 * >
 *   <Button>Modifier</Button>
 * </PermissionGate>
 */
export function PermissionGate({
  module,
  action,
  fallback = 'hide',
  fallbackMessage = "Vous n'avez pas la permission requise",
  children,
  renderNoAccess,
}: PermissionGateProps) {
  const { hasPermission } = usePermissions();
  const hasAccess = hasPermission(module, action);

  // Si l'utilisateur a la permission, afficher le contenu
  if (hasAccess) {
    return <>{children}</>;
  }

  // Si une fonction de rendu personnalisée est fournie, l'utiliser
  if (renderNoAccess) {
    return <>{renderNoAccess()}</>;
  }

  // Sinon, utiliser le mode de fallback approprié
  switch (fallback) {
    case 'hide':
      return null;
    case 'disable':
      // Cloner l'enfant et le désactiver
      return (
        <div style={{ opacity: 0.5, pointerEvents: 'none' }}>
          {children}
        </div>
      );
    case 'error':
      return (
        <div className="text-sm text-muted-foreground italic">
          {fallbackMessage}
        </div>
      );
    default:
      return null;
  }
}

interface PermissionGateAnyProps {
  module: string;
  actions: string[];
  require?: 'any' | 'all'; // 'any' = au moins une, 'all' = toutes
  fallback?: 'hide' | 'disable' | 'error';
  fallbackMessage?: string;
  children: ReactNode;
  renderNoAccess?: () => ReactNode;
}

/**
 * Composant pour vérifier plusieurs permissions (OU ou ET)
 *
 * @example
 * // Nécessite au moins une des permissions (mode par défaut)
 * <PermissionGateAny module="stock" actions={['create', 'update']}>
 *   <Button>Gérer le stock</Button>
 * </PermissionGateAny>
 *
 * @example
 * // Nécessite toutes les permissions
 * <PermissionGateAny module="stock" actions={['create', 'update']} require="all">
 *   <Button>Ajouter et modifier</Button>
 * </PermissionGateAny>
 */
export function PermissionGateAny({
  module,
  actions,
  require = 'any',
  fallback = 'hide',
  fallbackMessage = "Vous n'avez pas les permissions requises",
  children,
  renderNoAccess,
}: PermissionGateAnyProps) {
  const { hasAnyPermission, hasAllPermissions } = usePermissions();

  const hasAccess = require === 'all'
    ? hasAllPermissions(module, actions)
    : hasAnyPermission(module, actions);

  if (hasAccess) {
    return <>{children}</>;
  }

  if (renderNoAccess) {
    return <>{renderNoAccess()}</>;
  }

  switch (fallback) {
    case 'hide':
      return null;
    case 'disable':
      return (
        <div style={{ opacity: 0.5, pointerEvents: 'none' }}>
          {children}
        </div>
      );
    case 'error':
      return (
        <div className="text-sm text-muted-foreground italic">
          {fallbackMessage}
        </div>
      );
    default:
      return null;
  }
}
