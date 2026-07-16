"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Loader2, LayoutDashboard, Package, Wallet } from "lucide-react";

const BRAND_POINTS = [
  { icon: LayoutDashboard, label: "Pilotage en temps réel : ventes, stock, trésorerie" },
  { icon: Package, label: "Crédits clients & fournisseurs suivis à la ligne près" },
  { icon: Wallet, label: "Caisse, achats et rapports — tout au même endroit" },
];

export default function LoginPage() {
  const router = useRouter();
  const { signIn, loading, error, user, companies } = useAuth();
  const { getFirstAccessiblePage } = usePermissions();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authSuccess, setAuthSuccess] = useState(false);

  // Redirection intelligente après connexion
  useEffect(() => {
    if (authSuccess && user && companies.length > 0) {
      if (companies.length === 1) {
        const firstPage = getFirstAccessiblePage();
        router.push(firstPage);
      } else {
        router.push("/select-company");
      }
    }
  }, [authSuccess, user, companies, router, getFirstAccessiblePage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await signIn(email, password);
      setAuthSuccess(true);
      // La redirection sera gérée par useEffect
    } catch {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel — desktop only */}
      <aside className="relative hidden overflow-hidden bg-linear-to-br from-primary to-primary/80 p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage:
              "radial-gradient(60% 50% at 20% 10%, color-mix(in srgb, var(--store-bg, white) 30%, transparent), transparent), radial-gradient(50% 40% at 90% 90%, color-mix(in srgb, var(--store-bg, white) 18%, transparent), transparent)",
          }}
        />
        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-foreground/15">
            <span className="text-xl font-medium" style={{ fontFamily: "var(--font-serif)" }}>O</span>
          </div>
          <span className="text-xl tracking-tight" style={{ fontFamily: "var(--font-serif)", fontWeight: 500 }}>
            Omnigestion
          </span>
        </div>

        <div className="relative max-w-md">
          <h1
            className="text-balance leading-[1.05] tracking-tight"
            style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(2.5rem, 4vw, 3.5rem)", fontWeight: 500 }}
          >
            La gestion de votre entreprise, enfin simple.
          </h1>
          <ul className="mt-10 space-y-4">
            {BRAND_POINTS.map((p) => {
              const Icon = p.icon;
              return (
                <li key={p.label} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary-foreground/15">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-sm/relaxed text-primary-foreground/90">{p.label}</span>
                </li>
              );
            })}
          </ul>
        </div>

        <p className="relative text-xs text-primary-foreground/60">© Omnigestion</p>
      </aside>

      {/* Form panel */}
      <div className="flex min-h-screen items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm">
          {/* Mobile brand mark */}
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <span className="text-lg font-medium" style={{ fontFamily: "var(--font-serif)" }}>O</span>
            </div>
            <span className="text-lg tracking-tight" style={{ fontFamily: "var(--font-serif)", fontWeight: 500 }}>
              Omnigestion
            </span>
          </div>

          <div className="mb-8">
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-eyebrow text-muted-foreground/70">
              Connexion
            </p>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Bon retour</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Connectez-vous à votre espace de gestion
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="nom@exemple.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isSubmitting}
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Mot de passe</Label>
                <Link href="/forgot-password" className="text-sm text-primary hover:underline">
                  Mot de passe oublié ?
                </Link>
              </div>
              <PasswordInput
                id="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isSubmitting}
                autoComplete="current-password"
              />
            </div>

            <Button type="submit" className="mt-2 w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connexion...
                </>
              ) : (
                "Se connecter"
              )}
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Pas encore de compte ?{" "}
            <Link href="/register" className="font-medium text-primary hover:underline">
              Créer un compte
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
