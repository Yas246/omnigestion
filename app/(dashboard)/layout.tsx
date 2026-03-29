"use client";

import { ReactNode, useState } from "react";
import { Sidebar } from "@/components/layouts/Sidebar";
import { Header } from "@/components/layouts/Header";
import { useAuth } from "@/lib/auth-context";
import { Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { NotificationPermission } from "@/components/notification-permission";
import { useFCM } from "@/lib/hooks/useFCM";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  console.log('[DashboardLayout] Composant monté !'); // DEBUG

  const { user, loading } = useAuth();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { initializeFCM, permissionStatus, token } = useFCM();

  console.log('[DashboardLayout] user:', user, 'loading:', loading); // DEBUG

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // ✅ Auto-initialiser FCM pour les admins (une seule fois par session)
  useEffect(() => {
    if (user && user.role === 'admin' && permissionStatus === 'granted' && !token) {
      console.log('[DashboardLayout] Admin - Initialisation FCM auto');
      initializeFCM();
    }
  }, [user, permissionStatus, token, initializeFCM]);

  // ✅ Exposer resetFCM() dans la console pour le debug
  useEffect(() => {
    const resetFCM = () => {
      console.log('[resetFCM] Réinitialisation complète de FCM...');

      // 1. Supprimer les flags localStorage
      localStorage.removeItem('fcm-permission-granted');
      localStorage.removeItem('notification-permission-dismissed');

      console.log('[resetFCM] ✓ localStorage nettoyé');

      // 2. Unregister le service worker
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          registrations.forEach((registration) => {
            console.log('[resetFCM] Suppression du Service Worker:', registration.scope);
            registration.unregister();
          });
        });
      }

      // 3. Recharger la page pour tout réinitialiser
      console.log('[resetFCM] Rechargement de la page dans 1 seconde...');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    };

    // Exposer globalement
    (window as any).resetFCM = resetFCM;
    console.log('[DashboardLayout] Fonction resetFCM() disponible dans la console');
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col border-r bg-sidebar">
        <Sidebar showLogo={true} />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-64 lg:hidden flex flex-col bg-sidebar shadow-lg">
            <div className="flex h-16 items-center justify-between border-b px-6">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
                  O
                </div>
                <span className="text-xl font-bold">Omnigestion</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(false)}
              >
                <X className="h-6 w-6" />
              </Button>
            </div>
            <Sidebar showLogo={false} onMobileMenuClose={() => setMobileMenuOpen(false)} />
          </div>
        </>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onMenuClick={() => setMobileMenuOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>

      {/* Composant de permission FCM - uniquement pour les admins */}
      {user?.role === 'admin' && <NotificationPermission />}
    </div>
  );
}
