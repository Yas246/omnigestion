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
  Sparkles,
} from "lucide-react";

type NavItem = { name: string; href: string; icon: any; module: string };

/**
 * Atelier navigation.
 * - "Tableau de bord" stands alone at the top (no section eyebrow).
 * - "Rapports" + "Analyse IA" sit together in a bottom "Analyses" section.
 * A group is hidden when none of its items are permitted.
 */
const STANDALONE: NavItem = {
  name: "Tableau de bord",
  href: "/",
  icon: LayoutDashboard,
  module: "dashboard",
};

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Commercial",
    items: [
      { name: "Ventes", href: "/sales", icon: ShoppingCart, module: "sales" },
      { name: "Clientèle", href: "/clients", icon: Users, module: "clients" },
      { name: "Crédits clients", href: "/credits/clients", icon: CreditCard, module: "credits" },
    ],
  },
  {
    label: "Stock & achats",
    items: [
      { name: "Stock", href: "/stock", icon: Package, module: "stock" },
      { name: "Fournisseurs", href: "/suppliers", icon: User, module: "suppliers" },
    ],
  },
  {
    label: "Trésorerie",
    items: [{ name: "Caisse", href: "/cash", icon: Wallet, module: "cash" }],
  },
  {
    label: "Analyses",
    items: [
      { name: "Rapports", href: "/reports", icon: TrendingUp, module: "reports" },
      { name: "Analyse IA", href: "/analyse-ia", icon: Sparkles, module: "reports" },
    ],
  },
  {
    label: "Système",
    items: [{ name: "Paramètres", href: "/settings", icon: Settings, module: "settings" }],
  },
];

interface SidebarProps {
  showLogo?: boolean;
  onMobileMenuClose?: () => void;
}

export function Sidebar({ showLogo = true, onMobileMenuClose }: SidebarProps) {
  const pathname = usePathname();
  const { isAdmin, canAccessModule, getFirstAccessiblePage } = usePermissions();

  const isVisible = (item: NavItem) => isAdmin || canAccessModule(item.module);
  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(href + "/"));

  const handleNavClick = () => {
    onMobileMenuClose?.();
  };

  const logoHref = getFirstAccessiblePage();

  const renderItem = (item: NavItem) => {
    const active = isActive(item.href);
    const Icon = item.icon;
    return (
      <Link
        key={item.name}
        href={item.href}
        onClick={handleNavClick}
        className={cn(
          "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
          active
            ? "bg-primary/10 font-medium text-foreground"
            : "text-foreground/70 hover:bg-accent hover:text-foreground",
        )}
      >
        <span
          className={cn(
            "absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary transition-opacity",
            active ? "opacity-100" : "opacity-0",
          )}
        />
        <Icon
          className={cn(
            "h-4.5 w-4.5 shrink-0 transition-colors",
            active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
          )}
        />
        <span>{item.name}</span>
      </Link>
    );
  };

  return (
    <>
      {/* Wordmark */}
      {showLogo && (
        <div className="flex h-16 items-center border-b px-6">
          <Link href={logoHref} className="flex items-center gap-2.5" onClick={handleNavClick}>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <span className="text-lg font-medium" style={{ fontFamily: "var(--font-serif)" }}>
                O
              </span>
            </div>
            <div className="leading-none">
              <span
                className="block text-lg tracking-tight text-foreground"
                style={{ fontFamily: "var(--font-serif)", fontWeight: 500 }}
              >
                Omnigestion
              </span>
              <span className="mt-0.5 block text-[10px] uppercase tracking-widest text-muted-foreground/70">
                Gestion d’entreprise
              </span>
            </div>
          </Link>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {/* Tableau de bord — standalone, no eyebrow */}
        {isVisible(STANDALONE) && <div className="mb-5">{renderItem(STANDALONE)}</div>}

        {NAV_GROUPS.map((group) => {
          const items = group.items.filter(isVisible);
          if (items.length === 0) return null;
          return (
            <div key={group.label} className="mb-5">
              <p className="mb-1 px-3 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60">
                {group.label}
              </p>
              <div className="space-y-0.5">{items.map(renderItem)}</div>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t px-6 py-4">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
          Omnigestion · v1.0
        </p>
      </div>
    </>
  );
}
