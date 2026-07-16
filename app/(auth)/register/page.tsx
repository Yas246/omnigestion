"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Building2, User, Mail, LayoutDashboard, TrendingUp } from "lucide-react";

type BusinessSector = "commerce" | "commerce_and_services";

const BRAND_POINTS = [
  { icon: LayoutDashboard, label: "Tableau de bord, ventes, stock et caisse au même endroit" },
  { icon: Building2, label: "Pilotez plusieurs entreprises depuis un seul compte" },
  { icon: TrendingUp, label: "Rapports et statistiques en temps réel" },
];

export default function RegisterPage() {
  const router = useRouter();
  const { signUp, loading, error } = useAuth();

  // Champs entreprise
  const [companyName, setCompanyName] = useState("");
  const [businessSector, setBusinessSector] = useState<BusinessSector>("commerce");

  // Champs utilisateur
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [position, setPosition] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError("");

    if (password !== confirmPassword) {
      setValidationError("Les mots de passe ne correspondent pas");
      return;
    }

    if (password.length < 8) {
      setValidationError("Le mot de passe doit contenir au moins 8 caractères");
      return;
    }

    if (!companyName.trim()) {
      setValidationError("Veuillez entrer le nom de votre entreprise");
      return;
    }

    if (!firstName.trim() || !lastName.trim()) {
      setValidationError("Veuillez entrer votre nom et prénom");
      return;
    }

    setIsSubmitting(true);

    try {
      await signUp(email, password, companyName, firstName, lastName, position, phone, businessSector);
      router.push("/clients");
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
      {/* Form panel — LEFT (mirrored vs login) */}
      <div className="flex min-h-screen items-start justify-center p-6 py-10 lg:p-12 lg:py-16">
        <div className="w-full max-w-lg">
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
              Inscription
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Créez votre compte
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Quelques informations pour centraliser votre gestion.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {(error || validationError) && (
              <div className="rounded-md border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive">
                {error || validationError}
              </div>
            )}

            {/* Informations entreprise */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/70">
                  Entreprise
                </h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="company">Nom de l&apos;entreprise *</Label>
                  <Input
                    id="company"
                    type="text"
                    placeholder="Ma Société SARL"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="sector">Secteur d&apos;activité *</Label>
                  <Select value={businessSector} onValueChange={(value: BusinessSector) => setBusinessSector(value)}>
                    <SelectTrigger id="sector">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="commerce">Commerce</SelectItem>
                      <SelectItem value="commerce_and_services">Commerce et prestation de service</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            {/* Informations personnelles */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/70">
                  Vos informations
                </h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="lastName">Nom *</Label>
                  <Input
                    id="lastName"
                    type="text"
                    placeholder="Dupont"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="firstName">Prénom *</Label>
                  <Input
                    id="firstName"
                    type="text"
                    placeholder="Jean"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="position">Poste occupé</Label>
                  <Input
                    id="position"
                    type="text"
                    placeholder="Gérant, Directeur..."
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Téléphone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+241 XX XX XX XX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </section>

            {/* Connexion */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/70">
                  Connexion
                </h2>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
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
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="password">Mot de passe *</Label>
                    <PasswordInput
                      id="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={isSubmitting}
                      autoComplete="new-password"
                    />
                    <p className="text-xs text-muted-foreground">Minimum 8 caractères</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirmer *</Label>
                    <PasswordInput
                      id="confirmPassword"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={isSubmitting}
                      autoComplete="new-password"
                    />
                  </div>
                </div>
              </div>
            </section>

            <div className="space-y-4">
              <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Création du compte...
                  </>
                ) : (
                  "Créer mon compte"
                )}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Vous avez déjà un compte ?{" "}
                <Link href="/login" className="font-medium text-primary hover:underline">
                  Se connecter
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>

      {/* Brand panel — RIGHT (mirrored) */}
      <aside className="relative hidden overflow-hidden bg-linear-to-br from-primary to-primary/80 p-12 text-primary-foreground lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage:
              "radial-gradient(60% 50% at 80% 10%, color-mix(in srgb, var(--store-bg, white) 30%, transparent), transparent), radial-gradient(50% 40% at 20% 90%, color-mix(in srgb, var(--store-bg, white) 18%, transparent), transparent)",
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
          <h2
            className="text-balance leading-[1.05] tracking-tight"
            style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(2.5rem, 4vw, 3.5rem)", fontWeight: 500 }}
          >
            Centralisez toute votre gestion.
          </h2>
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
    </div>
  );
}
