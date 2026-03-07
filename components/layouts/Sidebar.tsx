"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/lib/hooks/usePermissions";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Wallet,
  User,
  Users,
  Settings,
  CreditCard,
  TrendingUp,
} from "lucide-react";

const allNavigation = [
  { name: "Tableau de bord", href: "/", icon: LayoutDashboard, module: "dashboard" },
  { name: "Ventes", href: "/sales", icon: ShoppingCart, module: "sales" },
  { name: "Stock", href: "/stock", icon: Package, module: "stock" },
  { name: "Caisse", href: "/cash", icon: Wallet, module: "cash" },
  { name: "Crédits Clients", href: "/credits/clients", icon: CreditCard, module: "credits" },
  { name: "Fournisseurs", href: "/suppliers", icon: User, module: "suppliers" },
  { name: "Rapports", href: "/reports", icon: TrendingUp, module: "reports" },
  { name: "Clientèle", href: "/clients", icon: Users, module: "clients" },
  { name: "Paramètres", href: "/settings", icon: Settings, module: "settings" },
];

interface SidebarProps {
  showLogo?: boolean;
  onMobileMenuClose?: () => void;
}

export function Sidebar({ showLogo = true, onMobileMenuClose }: SidebarProps) {
  const pathname = usePathname();
  const { isAdmin, canAccessModule } = usePermissions();

  // Filtrer la navigation en fonction des permissions
  const navigation = allNavigation.filter((item) => {
    // Les admins ont accès à tout
    if (isAdmin) return true;
    // Le dashboard est toujours accessible
    if (item.module === "dashboard") return true;
    // Vérifier les permissions pour les autres modules
    return canAccessModule(item.module);
  });

  const handleNavClick = () => {
    // Close mobile menu after navigation
    onMobileMenuClose?.();
  };

  return (
    <>
      {/* Logo - only show if enabled */}
      {showLogo && (
        <div className="flex h-16 items-center border-b px-6">
          <Link href="/dashboard" className="flex items-center gap-2" onClick={handleNavClick}>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
              O
            </div>
            <span className="text-xl font-bold">Omnigestion</span>
          </Link>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={handleNavClick}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-accent",
              )}
            >
              <Icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t p-4">
        <p className="text-xs text-center text-muted-foreground">
          Omnigestion v1.0.0
        </p>
      </div>
    </>
  );
}
