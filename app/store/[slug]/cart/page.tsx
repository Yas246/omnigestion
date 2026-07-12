'use client';

import { use, useState } from 'react';
import { useCart } from '@/lib/storefront/cart-context';
import { useBuyer } from '@/lib/storefront/buyer-context';
import { BuyerAuthModal } from '@/components/storefront/BuyerAuthModal';
import { API_ORIGIN } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Trash2, Minus, Plus, ArrowLeft, ShoppingCart, Check, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { mediaUrl } from '@/lib/api/client';

export default function CartPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { items, updateQty, remove, total, count, clear } = useCart();
  const { buyer, authHeader, logout } = useBuyer();
  const [authOpen, setAuthOpen] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [ordered, setOrdered] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState('');

  const handleCheckout = async () => {
    if (!buyer) {
      setAuthOpen(true);
      return;
    }
    setCheckingOut(true);
    try {
      const res = await fetch(`${API_ORIGIN}/api/v1/public/store/${slug}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Erreur lors de la commande');
      }
      const data = await res.json();
      setInvoiceNumber(data.invoice?.invoiceNumber ?? '');
      setOrdered(true);
      clear();
      toast.success('Commande passée avec succès !');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCheckingOut(false);
    }
  };

  // Success screen
  if (ordered) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-50 px-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
          <Check className="h-10 w-10 text-green-600" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Commande confirmée !</h1>
          {invoiceNumber && <p className="mt-2 text-sm text-gray-600">Référence : {invoiceNumber}</p>}
          <p className="mt-1 text-sm text-gray-500">Le marchand va traiter votre commande prochainement.</p>
        </div>
        <Link href={`/store/${slug}`}>
          <Button variant="outline">Retour à la boutique</Button>
        </Link>
      </div>
    );
  }

  // Empty cart
  if (count === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 px-4">
        <ShoppingCart className="h-16 w-16 text-gray-300" />
        <h1 className="text-xl font-medium text-gray-700">Votre panier est vide</h1>
        <Link href={`/store/${slug}`}>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" /> Retour à la boutique
          </Button>
        </Link>
      </div>
    );
  }

  // Cart with items
  return (
    <div className="min-h-screen bg-gray-50">
      <BuyerAuthModal open={authOpen} onOpenChange={setAuthOpen} onSuccess={handleCheckout} />
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Mon panier ({count})</h1>
          <Link href={`/store/${slug}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-1 h-4 w-4" /> Continuer mes achats
            </Button>
          </Link>
        </div>

        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.productId}>
              <CardContent className="flex items-center gap-4 py-4">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-gray-100">
                  {item.image ? (
                    <img src={mediaUrl(item.image) ?? ''} alt={item.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-gray-300">{item.name.charAt(0)}</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="truncate font-medium">{item.name}</h3>
                  <p className="text-sm text-muted-foreground">{item.price.toLocaleString('fr-FR')} FCFA</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQty(item.productId, item.quantity - 1)}>
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQty(item.productId, item.quantity + 1)}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <div className="w-24 text-right">
                  <p className="font-semibold">{(item.price * item.quantity).toLocaleString('fr-FR')}</p>
                  <p className="text-xs text-muted-foreground">FCFA</p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => remove(item.productId)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mt-6">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <span className="text-lg font-medium">Total</span>
              <div className="text-right">
                <p className="text-2xl font-bold">{total.toLocaleString('fr-FR')}</p>
                <p className="text-xs text-muted-foreground">FCFA</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Buyer status */}
        <div className="mt-4 flex items-center justify-between text-sm">
          {buyer ? (
            <>
              <span className="text-muted-foreground">Connecté en tant que <strong>{buyer.fullName ?? buyer.email}</strong></span>
              <button onClick={logout} className="text-muted-foreground underline hover:text-foreground">Déconnexion</button>
            </>
          ) : (
            <span className="text-muted-foreground">Vous devrez vous connecter pour commander.</span>
          )}
        </div>

        <div className="mt-6 flex justify-between">
          <Button variant="ghost" onClick={clear}>
            <Trash2 className="mr-2 h-4 w-4" /> Vider
          </Button>
          <Button size="lg" onClick={handleCheckout} disabled={checkingOut}>
            {checkingOut ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Traitement...</>
            ) : buyer ? (
              `Commander · ${total.toLocaleString('fr-FR')} FCFA`
            ) : (
              'Se connecter pour commander'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
