'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Building2, User, Mail } from 'lucide-react';

type BusinessSector = 'commerce' | 'commerce_and_services';

export default function RegisterPage() {
  const router = useRouter();
  const { signUp, loading, error } = useAuth();

  // Champs entreprise
  const [companyName, setCompanyName] = useState('');
  const [businessSector, setBusinessSector] = useState<BusinessSector>('commerce');

  // Champs utilisateur
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [position, setPosition] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    // Validation
    if (password !== confirmPassword) {
      setValidationError('Les mots de passe ne correspondent pas');
      return;
    }

    if (password.length < 6) {
      setValidationError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    if (!companyName.trim()) {
      setValidationError('Veuillez entrer le nom de votre entreprise');
      return;
    }

    if (!firstName.trim() || !lastName.trim()) {
      setValidationError('Veuillez entrer votre nom et prénom');
      return;
    }

    if (!position.trim()) {
      setValidationError('Veuillez entrer votre poste occupé');
      return;
    }

    if (!phone.trim()) {
      setValidationError('Veuillez entrer votre numéro de téléphone');
      return;
    }

    setIsSubmitting(true);

    try {
      await signUp(email, password, companyName, firstName, lastName, position, phone, businessSector);
      router.push('/dashboard');
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
    <div className="flex min-h-screen items-center justify-center bg-background p-4 py-8">
      <Card className="w-full max-w-2xl shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-xl">
              O
            </div>
          </div>
          <CardTitle className="text-3xl font-bold">Omnigestion</CardTitle>
          <CardDescription>Créez votre compte et commencez à gérer votre entreprise</CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            {(error || validationError) && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                {error || validationError}
              </div>
            )}

            {/* Informations entreprise */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2">
                <Building2 className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Informations entreprise</h3>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
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

                <div className="space-y-2">
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
            </div>

            {/* Informations personnelles */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2">
                <User className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Vos informations</h3>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
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
                  <Label htmlFor="position">Poste occupé *</Label>
                  <Input
                    id="position"
                    type="text"
                    placeholder="Gérant, Directeur..."
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Téléphone *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+241 XX XX XX XX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </div>

            {/* Informations de connexion */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2">
                <Mail className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Connexion</h3>
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

                <div className="grid gap-4 md:grid-cols-2">
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
                    <p className="text-xs text-muted-foreground">
                      Minimum 6 caractères
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirmer le mot de passe *</Label>
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
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-4">
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Création du compte...
                </>
              ) : (
                'Créer mon compte'
              )}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Vous avez déjà un compte ?{' '}
              <Link href="/login" className="text-primary hover:underline font-medium">
                Se connecter
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
