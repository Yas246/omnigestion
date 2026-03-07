'use client';

import { useOnlineStatus } from '@/lib/hooks/useOnlineStatus';
import { Wifi, WifiOff } from 'lucide-react';

export function NetworkStatusIndicator() {
  const isOnline = useOnlineStatus();

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/50 hover:bg-muted transition-colors" title={isOnline ? 'En ligne' : 'Hors ligne'}>
      {isOnline ? (
        <>
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <Wifi className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
          <span className="text-xs font-medium text-green-600 dark:text-green-400 hidden sm:inline">
            En ligne
          </span>
        </>
      ) : (
        <>
          <div className="h-2 w-2 rounded-full bg-red-500" />
          <WifiOff className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
          <span className="text-xs font-medium text-red-600 dark:text-red-400 hidden sm:inline">
            Hors ligne
          </span>
        </>
      )}
    </div>
  );
}
