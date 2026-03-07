'use client';

import { useOnlineStatus } from '@/lib/hooks/useOnlineStatus';
import { WifiOff } from 'lucide-react';

export function PWAInstallPrompt() {
  const isOnline = useOnlineStatus();

  return (
    <>
      {/* Status bar réseau - seulement hors ligne */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-white px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium shadow-lg">
          <WifiOff className="h-4 w-4" />
          Mode hors ligne - Certaines fonctionnalités peuvent être limitées
        </div>
      )}
    </>
  );
}
