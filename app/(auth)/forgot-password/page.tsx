"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useEffect } from "react";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { resetPassword, loading, error } = useAuth();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[ForgotPassword] Formulaire soumis avec email:', email);
    setIsSubmitting(true);

    try {
      console.log('[ForgotPassword] Appel de resetPassword...');
      await resetPassword(email);
      console.log('[ForgotPassword] resetPassword réussi, affichage succès');
      setIsSuccess(true);

      // Redirection vers login après 5 secondes
      setTimeout(() => {
        console.log('[ForgotPassword] Redirection vers /login');
        router.push("/login");
      }, 5000);
    } catch (err) {
      console.error('[ForgotPassword] Erreur lors de resetPassword:', err);
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-3xl font-bold">Omnigestion</CardTitle>
          <CardDescription>
            {isSuccess
              ? "Email de réinitialisation envoyé !"
              : "Entrez votre email pour réinitialiser votre mot de passe"
            }
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {isSuccess ? (
            <div className="flex flex-col items-center space-y-4 py-4">
              <CheckCircle2 className="h-16 w-16 text-green-600" />
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  Un email contenant un lien de réinitialisation a été envoyé à :
                </p>
                <p className="font-medium text-foreground">{email}</p>
                <p className="text-sm text-muted-foreground">
                  Vérifiez votre boîte de réception et cliquez sur le lien pour réinitialiser votre mot de passe.
                </p>
                <p className="text-xs text-muted-foreground">
                  Si vous ne recevez pas l'email dans quelques minutes, vérifiez vos spams.
                </p>
              </div>
              <div className="text-center text-sm text-muted-foreground">
                Vous serez redirigé vers la page de connexion dans quelques secondes...
              </div>
            </div>
          ) : (
            <>
              {error && (
                <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="space-y-4">
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

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isSubmitting || !email}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Envoi en cours...
                      </>
                    ) : (
                      "Envoyer le lien de réinitialisation"
                    )}
                  </Button>
                </div>
              </form>
            </>
          )}
        </CardContent>

        <CardFooter className="flex justify-center">
          <Link
            href="/login"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour à la connexion
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
