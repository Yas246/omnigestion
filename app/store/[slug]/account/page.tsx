'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';

const AddressMapPicker = dynamic(() => import('@/components/storefront/AddressMapPicker'), { ssr: false });
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { LogOut, MapPin, Plus, Trash2, QrCode, Package, ArrowLeft, Star } from 'lucide-react';
import { API_ORIGIN } from '@/lib/api/client';
import { useBuyer } from '@/lib/storefront/buyer-context';
import { formatPrice } from '@/lib/format';

interface Order {
  id: number;
  invoiceNumber: string;
  clientName: string | null;
  total: number;
  status: string;
  date: string;
  delivery: { id: number; status: string; driverName: string | null; address: string | null; deliveredAt: string | null; hasQr: boolean } | null;
}
interface Address {
  id: number;
  label: string;
  recipientName: string | null;
  address: string;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  isDefault: boolean;
  notes: string | null;
}

const DELIV_LABEL: Record<string, string> = {
  pending: 'En attente',
  assigned: 'Livreur attribué',
  picked_up: 'Colis récupéré',
  in_transit: 'En route',
  delivered: 'Livrée',
  failed: 'Échouée',
  cancelled: 'Annulée',
};

// Distinct color per status so progress is readable at a glance
// (gray → blue → amber → brand → green; red for failure).
const DELIV_VARIANT: Record<string, 'secondary' | 'info' | 'warning' | 'default' | 'success' | 'destructive' | 'outline'> = {
  pending: 'secondary',
  assigned: 'info',
  picked_up: 'warning',
  in_transit: 'default',
  delivered: 'success',
  failed: 'destructive',
  cancelled: 'outline',
};

export default function BuyerAccountPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const router = useRouter();
  const { buyer, logout, authHeader } = useBuyer();

  const [orders, setOrders] = useState<Order[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [qrFor, setQrFor] = useState<{ deliveryId: number; token: string } | null>(null);
  const [addrOpen, setAddrOpen] = useState(false);
  const [addrForm, setAddrForm] = useState({
    label: 'domicile',
    address: '',
    city: '',
    notes: '',
    latitude: null as number | null,
    longitude: null as number | null,
  });

  const base = `${API_ORIGIN}/api/v1/public/store/${slug}/account`;
  const [companyName, setCompanyName] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_ORIGIN}/api/v1/public/store/${slug}`)
      .then((r) => r.json())
      .then((d) => setCompanyName(d?.company?.name ?? null))
      .catch(() => {});
  }, [slug]);

  const load = async () => {
    try {
      const [o, a] = await Promise.all([
        fetch(`${base}/orders`, { headers: authHeader() }),
        fetch(`${base}/addresses`, { headers: authHeader() }),
      ]);
      if (o.ok) setOrders(await o.json());
      if (a.ok) setAddresses(await a.json());
    } catch {}
  };
  useEffect(() => {
    if (buyer) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buyer]);

  const header = (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
      <div className="relative mx-auto flex max-w-3xl items-center justify-center px-4 py-4">
        <Link href={`/store/${slug}`} className="absolute left-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Boutique</span>
        </Link>
        <span className="font-semibold tracking-tight">{companyName ?? 'Mon compte'}</span>
      </div>
    </header>
  );

  if (!buyer) {
    return (
      <div className="min-h-screen">
        {header}
        <div className="mx-auto max-w-md p-8">
          <Card>
            <CardContent className="py-10 text-center">
              <p className="font-medium">Connectez-vous pour voir votre compte</p>
              <p className="mt-1 text-sm text-muted-foreground">Commandes, adresses et suivi de livraison.</p>
              <div className="mt-4 flex justify-center gap-2">
                <Button asChild><Link href={`/store/${slug}`}>Retour à la boutique</Link></Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const showQr = async (orderId: number) => {
    try {
      const res = await fetch(`${base}/orders/${orderId}/qr`, { headers: authHeader() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'QR indisponible');
      if (!data.qrToken) return toast.info('Livraison non encore attribuée');
      setQrFor({ deliveryId: data.deliveryId, token: data.qrToken });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const addAddress = async () => {
    if (!addrForm.address.trim()) return toast.error('Adresse requise');
    const res = await fetch(`${base}/addresses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ ...addrForm, isDefault: addresses.length === 0 }),
    });
    if (!res.ok) { const b = await res.json().catch(() => ({})); return toast.error(b.message || 'Erreur'); }
    setAddrOpen(false);
    setAddrForm({ label: 'domicile', address: '', city: '', notes: '', latitude: null, longitude: null });
    toast.success('Adresse ajoutée');
    load();
  };

  const deleteAddress = async (id: number) => {
    await fetch(`${base}/addresses/${id}`, { method: 'DELETE', headers: authHeader() });
    toast.success('Adresse supprimée');
    load();
  };

  const setDefaultAddress = async (a: Address) => {
    const res = await fetch(`${base}/addresses/${a.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ ...a, isDefault: true }),
    });
    if (!res.ok) { const b = await res.json().catch(() => ({})); return toast.error(b.message || 'Erreur'); }
    toast.success('Adresse par défaut mise à jour');
    load();
  };

  const doLogout = () => {
    logout();
    router.push(`/store/${slug}`);
  };

  return (
    <div className="min-h-screen">
      {header}
      <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Mon compte</h1>
          <p className="text-sm text-muted-foreground">{buyer.email}{buyer.fullName ? ` · ${buyer.fullName}` : ''}</p>
        </div>
        <Button variant="outline" onClick={doLogout}>
          <LogOut className="mr-2 h-4 w-4" /> Se déconnecter
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Package className="h-4 w-4" /> Mes commandes</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune commande pour le moment.</p>
          ) : (
            orders.map((o) => (
              <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
                <div>
                  <p className="font-medium">{o.invoiceNumber} · {formatPrice(o.total)}</p>
                  <p className="text-xs text-muted-foreground">{new Date(o.date).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  {o.delivery ? (
                    <>
                      <Badge variant={DELIV_VARIANT[o.delivery.status] ?? 'secondary'}>{DELIV_LABEL[o.delivery.status] ?? o.delivery.status}</Badge>
                      {o.delivery.hasQr && (
                        <Button size="sm" variant="outline" onClick={() => showQr(o.id)}>
                          <QrCode className="mr-1 h-4 w-4" /> QR livraison
                        </Button>
                      )}
                    </>
                  ) : (
                    <Badge variant="secondary">En préparation</Badge>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base"><MapPin className="h-4 w-4" /> Mes adresses</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setAddrOpen(true)}><Plus className="mr-1 h-4 w-4" /> Ajouter</Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {addresses.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune adresse enregistrée.</p>
          ) : (
            addresses.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-md border p-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{a.label}</p>
                    {a.isDefault && <Badge variant="success">Par défaut</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">{a.address}{a.city ? `, ${a.city}` : ''}</p>
                </div>
                <div className="flex items-center gap-1">
                  {!a.isDefault && (
                    <Button size="sm" variant="outline" onClick={() => setDefaultAddress(a)}>
                      <Star className="mr-1 h-4 w-4" />Définir par défaut
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" onClick={() => deleteAddress(a.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={addrOpen} onOpenChange={setAddrOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouvelle adresse</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Libellé</Label><Input value={addrForm.label} onChange={(e) => setAddrForm({ ...addrForm, label: e.target.value })} placeholder="domicile, bureau…" /></div>
            <div>
              <Label>Adresse sur la carte</Label>
              <p className="mb-2 text-xs text-muted-foreground">Cherchez, utilisez votre position, ou déplacez le point pour ajuster. L&apos;adresse se remplit automatiquement.</p>
              <AddressMapPicker
                onChange={(v) => setAddrForm((f) => ({ ...f, address: v.address, city: v.city ?? '', latitude: v.latitude, longitude: v.longitude }))}
              />
            </div>
            <div><Label>Notes</Label><Input value={addrForm.notes} onChange={(e) => setAddrForm({ ...addrForm, notes: e.target.value })} placeholder="Instructions pour le livreur…" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddrOpen(false)}>Annuler</Button>
            <Button onClick={addAddress}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!qrFor} onOpenChange={(o) => !o && setQrFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>QR de confirmation</DialogTitle></DialogHeader>
          <div className="flex flex-col items-center gap-3 py-2">
            {qrFor && (
              <div className="rounded-lg border bg-white p-4">
                <QRCodeSVG value={JSON.stringify({ deliveryId: qrFor.deliveryId, qrToken: qrFor.token })} size={200} />
              </div>
            )}
            <p className="text-center text-sm text-muted-foreground">Montrez ce QR au livreur à l&apos;arrivée pour confirmer la livraison.</p>
          </div>
          <DialogFooter><Button onClick={() => setQrFor(null)}>Fermer</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
