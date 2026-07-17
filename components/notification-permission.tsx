// FCM est un stub sans backend : la bannière de permission est désactivée
// pour ne pas induire l'utilisateur en erreur. Le composant reste exporté
// car il est importé ailleurs (app/(dashboard)/layout.tsx).

'use client';

export function NotificationPermission() {
  return null;
}
