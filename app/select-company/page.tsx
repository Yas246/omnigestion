"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Building2, Check } from "lucide-react";

export default function SelectCompanyPage() {
  const router = useRouter();
  const { user, companies, currentCompany, loading, switchCompany } = useAuth();

  useEffect(() => {
    // Si l'utilisateur n'est pas connecté, rediriger vers login
    if (!loading && !user) {
      router.push("/login");
      return;
    }

    // Si l'utilisateur a une seule entreprise, aller directement au dashboard
    if (!loading && companies.length === 1 && currentCompany) {
      router.push("/dashboard");
      return;
    }

    // Si pas d'entreprises du tout (ne devrait pas arriver), aller au dashboard
    if (!loading && companies.length === 0) {
      router.push("/dashboard");
      return;
    }
  }, [loading, user, companies, currentCompany, router]);

  const handleSelectCompany = async (companyId: string) => {
    try {
      await switchCompany(companyId);
      router.push("/dashboard");
    } catch (error) {
      console.error("Erreur lors de la sélection de l'entreprise:", error);
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
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-xl">
              O
            </div>
          </div>
          <h1 className="text-3xl font-bold mb-2">
            Bienvenue, {user?.displayName || user?.email} !
          </h1>
          <p className="text-muted-foreground">
            Vous avez accès à plusieurs entreprises. Sélectionnez celle que vous
            souhaitez gérer :
          </p>
        </div>

        <div className="grid gap-4">
          {companies.map((company) => (
            <Card
              key={company.id}
              className={`cursor-pointer transition-all hover:shadow-lg ${
                currentCompany?.id === company.id ? "ring-2 ring-primary" : ""
              }`}
            >
              <CardContent className="p-6">
                <div
                  className="flex items-center justify-between"
                  onClick={() => handleSelectCompany(company.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                      <Building2 className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{company.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {company.businessSector === "commerce"
                          ? "Commerce"
                          : "Commerce et services"}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant={
                      currentCompany?.id === company.id ? "default" : "outline"
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectCompany(company.id);
                    }}
                  >
                    {currentCompany?.id === company.id ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Actuelle
                      </>
                    ) : (
                      "Sélectionner"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          <Card className="border-dashed">
            <CardContent className="p-6">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => router.push("/dashboard/settings?tab=system")}
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                    <Building2 className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">
                      Créer une nouvelle entreprise
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Ajouter une nouvelle entreprise à votre compte
                    </p>
                  </div>
                </div>
                <Button variant="ghost">→</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Vous pourrez changer d&apos;entreprise à tout moment depuis le menu
        </p>
      </div>
    </div>
  );
}
