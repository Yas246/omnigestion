'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useBuyer } from '@/lib/storefront/buyer-context';

export function BuyerAuthModal({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}) {
  const { login, signup } = useBuyer();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      if (mode === 'signup') {
        await signup(email, password, fullName || undefined, phone || undefined);
      } else {
        await login(email, password);
      }
      onOpenChange(false);
      // Defer onSuccess so the parent re-renders with the new buyer state
      // (React batches state updates — calling onSuccess synchronously would
      // see the stale `buyer` from the closure and re-open the modal).
      setTimeout(() => onSuccess?.(), 50);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'login' ? 'Connexion' : 'Créer un compte'}</DialogTitle>
          <DialogDescription>
            {mode === 'login'
              ? 'Connectez-vous pour finaliser votre commande'
              : 'Créez un compte pour commander et suivre vos achats'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {mode === 'signup' && (
            <>
              <div>
                <Label className="text-xs">Nom complet</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jean Dupont" />
              </div>
              <div>
                <Label className="text-xs">Téléphone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+229 ..." />
              </div>
            </>
          )}
          <div>
            <Label className="text-xs">Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@email.com" />
          </div>
          <div>
            <Label className="text-xs">Mot de passe</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            <p className="mt-1 text-xs text-muted-foreground">Minimum 8 caractères</p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <Button onClick={handleSubmit} disabled={loading || !email || !password}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); }}>
            {mode === 'login' ? 'Pas de compte ? S\'inscrire' : 'Déjà un compte ? Se connecter'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
