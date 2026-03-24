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
  const { isAdmin, canAccessModule, getFirstAccessiblePage } = usePermissions();

  // Filtrer la navigation en fonction des permissions
  const navigation = allNavigation.filter((item) => {
    // Les admins ont accès à tout
    if (isAdmin) return true;
    // Vérifier les permissions pour tous les modules, y compris le dashboard
    return canAccessModule(item.module);
  });

  const handleNavClick = () => {
    // Close mobile menu after navigation
    onMobileMenuClose?.();
  };

  // Rediriger le logo vers la première page accessible
  const logoHref = getFirstAccessiblePage();

  return (
    <>
      {/* Logo - only show if enabled */}
      {showLogo && (
        <div className="flex h-16 items-center border-b px-6 bg-linear-to-r from-primary/5 to-transparent">
          <Link href={logoHref} className="flex items-center gap-2" onClick={handleNavClick}>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-primary to-primary/80 text-primary-foreground font-bold shadow-sm">
              O
            </div>
            <span className="text-xl font-bold bg-linear-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Omnigestion
            </span>
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
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 relative group",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-foreground hover:bg-accent hover:pl-4",
              )}
            >
              <Icon className={cn(
                "h-5 w-5 transition-transform duration-200",
                !isActive && "group-hover:scale-110"
              )} />
              <span className={cn(
                "transition-opacity duration-200",
                isActive && "font-semibold"
              )}>
                {item.name}
              </span>
              {!isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-0 bg-primary rounded-r-full opacity-0 group-hover:h-4 group-hover:opacity-100 transition-all duration-200" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t p-4 bg-linear-to-t from-primary/5 to-transparent">
        <p className="text-xs text-center text-muted-foreground">
          Omnigestion v1.0.0
        </p>
      </div>
    </>
  );
}
