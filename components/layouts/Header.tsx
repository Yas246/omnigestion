"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { NetworkStatusIndicator } from "@/components/pwa";
import {
  LogOut,
  User as UserIcon,
  Settings,
  Menu,
  Building2,
  Check,
} from "lucide-react";

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user, signOut, companies, currentCompany, switchCompany } = useAuth();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      router.push("/login");
    } catch (error) {
      console.error("Erreur lors de la déconnexion:", error);
      setIsSigningOut(false);
    }
  };

  const handleSwitchCompany = async (companyId: string) => {
    if (companyId === currentCompany?.id || isSwitching) return;

    setIsSwitching(true);
    try {
      await switchCompany(companyId);
      window.location.reload(); // Recharger pour appliquer le changement
    } catch (error) {
      console.error("Erreur lors du changement d'entreprise:", error);
      setIsSwitching(false);
    }
  };

  const getUserInitials = () => {
    if (!user) return "?";
    const displayName = user.displayName || user.email;
    if (!displayName) return "?";
    return displayName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-6">
      <div className="flex flex-1 items-center gap-4">
        {/* Hamburger menu button - visible only on mobile */}
        {onMenuClick && (
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onMenuClick}
          >
            <Menu className="h-6 w-6" />
          </Button>
        )}

        {/* Spacer pour pousser le contenu utilisateur à droite */}
        <div className="flex-1" />

        <div className="flex items-center gap-3">
          {/* Indicateur de statut réseau */}
          <NetworkStatusIndicator />

          {/* Sélecteur d'entreprise - admin uniquement avec plusieurs entreprises */}
          {user?.role === "admin" && companies.length > 1 && currentCompany && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="gap-2"
                  disabled={isSwitching}
                >
                  <Building2 className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {currentCompany.name}
                  </span>
                  <span className="sm:hidden">
                    {currentCompany.name.slice(0, 15)}
                    {currentCompany.name.length > 15 ? "..." : ""}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">Entreprises</p>
                    <p className="text-xs text-muted-foreground">
                      Sélectionnez l&apos;entreprise à gérer
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {companies.map((company) => (
                  <DropdownMenuItem
                    key={company.id}
                    onClick={() => handleSwitchCompany(company.id)}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span>{company.name}</span>
                    </div>
                    {company.id === currentCompany.id && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {/* User info - hidden on mobile */}
          <div className="text-right text-sm hidden md:block">
            <p className="font-medium">{user?.displayName || user?.email}</p>
            <p className="text-xs text-muted-foreground capitalize">
              {user?.role === "admin" ? "Administrateur" : "Employé"}
            </p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-10 w-10 rounded-full"
              >
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {user?.displayName || "Utilisateur"}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/settings")}>
                <Settings className="mr-2 h-4 w-4" />
                Paramètres
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} disabled={isSigningOut}>
                <LogOut className="mr-2 h-4 w-4" />
                {isSigningOut ? "Déconnexion..." : "Se déconnecter"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
