'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Truck, Play, Navigation, QrCode, CheckCircle2, XCircle, MapPin } from 'lucide-react';
import { formatPrice, groupByDay } from '@/lib/format';
import { useMyDeliveries, useDeliveries, type DeliveryDto, type DeliveryStatus } from '@/lib/api/hooks/useDeliveries';
import { usePermissions } from '@/lib/hooks/usePermissions';
import QrScanner from '@/components/deliveries/QrScanner';

const DeliveryMap = dynamic(() => import('@/components/deliveries/DeliveryMap'), { ssr: false });

const STATUS_LABEL: Record<DeliveryStatus, string> = {
  pending: 'À attribuer',
  assigned: 'Attribuée',
  picked_up: 'Récupérée',
  in_transit: 'En route',
  delivered: 'Livrée',
  failed: 'Échouée',
  cancelled: 'Annulée',
};

export default function LivreurPage() {
  const { isAdmin, canCompleteDelivery } = usePermissions();
  const { deliveries } = useMyDeliveries();
  const m = useDeliveries();

  const [activeId, setActiveId] = useState<number | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [scannedToken, setScannedToken] = useState<string | null>(null);
  const [codMethod, setCodMethod] = useState<'cash' | 'mobile' | 'bank'>('cash');
  const [failOpen, setFailOpen] = useState(false);
  const [failReason, setFailReason] = useState('');
  const [pos, setPos] = useState<{ latitude: number; longitude: number } | null>(null);
  const [route, setRoute] = useState<Array<[number, number]> | null>(null);

  // Derive the open delivery from the LIVE list (refetched after every action
  // via invalidate) so its status/buttons update instantly — no manual refresh.
  const active = useMemo(() => deliveries.find((d) => d.id === activeId) ?? null, [deliveries, activeId]);

  const activeList = useMemo(
    () => deliveries.filter((d) => ['assigned', 'picked_up', 'in_transit'].includes(d.status)),
    [deliveries]
  );
  const doneList = useMemo(() => deliveries.filter((d) => d.status === 'delivered'), [deliveries]);
  const todayCod = doneList.filter((d) => isToday(d.deliveredAt)).reduce((s, d) => s + d.codAmount, 0);

  // Live position: watch while there is an active tour, post ~every 20s.
  // The effect depends only on a STABLE boolean (hasActiveTour). `activeList`
  // and the mutation fn are read via refs — otherwise the new array/fn ref each
  // render would re-run the watcher, whose setPos would re-render → infinite loop.
  const hasActiveTour = activeList.some((d) => d.status === 'in_transit' || d.status === 'picked_up');
  const activeListRef = useRef(activeList);
  activeListRef.current = activeList;
  const updatePositionRef = useRef(m.updatePosition);
  updatePositionRef.current = m.updatePosition;
  const lastPost = useRef(0);
  useEffect(() => {
    if (!('geolocation' in navigator)) return;
    if (!hasActiveTour) return;
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const coords = { latitude: p.coords.latitude, longitude: p.coords.longitude };
        setPos(coords);
        const now = Date.now();
        if (now - lastPost.current > 20000) {
          lastPost.current = now;
          for (const d of activeListRef.current) {
            if (d.status === 'in_transit' || d.status === 'picked_up') {
              updatePositionRef.current({ id: d.id, ...coords }).catch(() => {});
            }
          }
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 15000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [hasActiveTour]);

  // Draw the driving route from the driver's position to the customer once we
  // have both (OSRM public router; CSP already allows router.project-osrm.org).
  // Fails silently — no polyline if the service has no route for the area.
  const routeDestRef = useRef<string | null>(null);
  const lastRouteFetch = useRef(0);
  useEffect(() => {
    if (!pos || active?.latitude == null || active?.longitude == null) {
      setRoute(null);
      routeDestRef.current = null;
      return;
    }
    const destKey = `${active.latitude},${active.longitude}`;
    // Throttle: the driver's position updates often, but we only refetch the
    // route when the destination changes or ~30s have elapsed.
    if (routeDestRef.current === destKey && Date.now() - lastRouteFetch.current < 30000) return;
    routeDestRef.current = destKey;
    lastRouteFetch.current = Date.now();
    let cancelled = false;
    // OSRM expects coordinates as lng,lat (the destKey above is just a throttle
    // cache key in lat,lng — do NOT reuse it as the endpoint coordinate).
    const url = `https://router.project-osrm.org/route/v1/driving/${pos.longitude},${pos.latitude};${active.longitude},${active.latitude}?overview=full&geometries=geojson`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const coords = data?.routes?.[0]?.geometry?.coordinates;
        if (Array.isArray(coords)) {
          setRoute(coords.map(([lng, lat]: [number, number]) => [lat, lng] as [number, number]));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pos, active?.latitude, active?.longitude]);

  const allowed = isAdmin || canCompleteDelivery;

  if (!allowed) {
    return (
      <div className="mx-auto max-w-md p-6">
        <Card>
          <CardContent className="py-10 text-center">
            <Truck className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-medium">Accès réservé aux livreurs</p>
            <p className="mt-1 text-sm text-muted-foreground">Votre compte n&apos;a pas la permission de conduire des livraisons.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handlePickup = async (id: number) => {
    try { await m.pickupDelivery(id); toast.success('Récupérée'); } catch (e: any) { toast.error(e.message); }
  };
  const handleStart = async (id: number) => {
    try { await m.startDelivery(id); toast.success('En route'); } catch (e: any) { toast.error(e.message); }
  };
  const handleScanned = (text: string) => {
    // The buyer's QR encodes { deliveryId, qrToken } as JSON. Extract the token
    // AND the deliveryId — the backend checks the token server-side; the
    // deliveryId lets us reject immediately a QR from another order (e.g. an
    // old delivery's QR scanned by mistake).
    let token = text.trim();
    let deliveryId: number | null = null;
    try {
      const parsed = JSON.parse(token);
      if (parsed && typeof parsed.qrToken === 'string') token = parsed.qrToken;
      if (parsed && typeof parsed.deliveryId === 'number') deliveryId = parsed.deliveryId;
    } catch {
      /* not JSON — assume the raw token was scanned, use as-is */
    }
    if (deliveryId != null && active && deliveryId !== active.id) {
      toast.error('Ce QR correspond à une autre livraison');
      return; // keep the scanner open so the driver can re-scan
    }
    setScannedToken(token);
    setScanOpen(false);
    toast.success('QR scanné — confirmez la livraison');
  };
  const handleComplete = async (id: number) => {
    // The buyer's QR is MANDATORY — never fall back to a token we might have
    // had in-app. The driver must physically scan the customer's QR.
    if (!scannedToken) {
      toast.error('Scannez le QR du client pour confirmer');
      return;
    }
    try {
      await m.completeDelivery({ id, scannedQrToken: scannedToken, codPaymentMethod: codMethod });
      toast.success('Livraison confirmée — COD encaissé');
      setActiveId(null);
      setScannedToken(null);
    } catch (e: any) {
      toast.error(e.message || 'Échec confirmation');
    }
  };
  const handleFail = async (id: number) => {
    try { await m.failDelivery({ id, reason: failReason || 'Non précisé' }); toast.success('Marquée échouée'); setFailOpen(false); setActiveId(null); setFailReason(''); } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Mes livraisons</h1>
          <p className="text-sm text-muted-foreground">{activeList.length} en cours · {doneList.length} terminées</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">COD du jour</p>
          <p className="text-lg font-semibold">{formatPrice(todayCod)}</p>
        </div>
      </div>

      {active && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span>{active.clientName ?? 'Client'}</span>
              <Badge>{STATUS_LABEL[active.status]}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm"><MapPin className="mr-1 inline h-4 w-4" />{active.address ?? 'Adresse non précisée'}</p>
            <div className="flex items-center justify-between rounded-md bg-muted/40 p-2 text-sm">
              <span className="text-muted-foreground">À encaisser (COD)</span>
              <span className="font-semibold">{formatPrice(active.codAmount)}</span>
            </div>
            {active.latitude != null && (
              <DeliveryMap latitude={active.latitude} longitude={active.longitude} address={active.address ?? undefined} driver={pos} route={route} height={260} />
            )}
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <Label className="text-xs">Mode d&apos;encaissement</Label>
                <Select value={codMethod} onValueChange={(v) => setCodMethod(v as any)}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Espèces</SelectItem>
                    <SelectItem value="mobile">Mobile money</SelectItem>
                    <SelectItem value="bank">Banque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap gap-2">
                {active.status === 'assigned' && <Button onClick={() => handlePickup(active.id)}><Play className="mr-1 h-4 w-4" /> Récupérer</Button>}
                {active.status === 'picked_up' && <Button onClick={() => handleStart(active.id)}><Navigation className="mr-1 h-4 w-4" /> En route</Button>}
                <Button variant="outline" onClick={() => setScanOpen(true)}><QrCode className="mr-1 h-4 w-4" /> Scanner QR</Button>
                <Button onClick={() => handleComplete(active.id)} disabled={!scannedToken}>
                  <CheckCircle2 className="mr-1 h-4 w-4" /> Confirmer
                </Button>
                <Button variant="ghost" onClick={() => setFailOpen(true)}><XCircle className="mr-1 h-4 w-4" /> Échouer</Button>
                <Button variant="ghost" onClick={() => setActiveId(null)}>Fermer</Button>
              </div>
            </div>
            {scannedToken && <p className="text-xs text-emerald-600">QR validé ✓</p>}
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {activeList.length === 0 && !active && (
          <p className="py-8 text-center text-sm text-muted-foreground">Aucune livraison assignée pour le moment.</p>
        )}
        {activeList.map((d) => (
          <Card key={d.id} className={active?.id === d.id ? 'border-primary' : ''}>
            <CardContent className="flex items-center justify-between p-4">
              <div className="min-w-0">
                <p className="font-medium">{d.clientName ?? 'Client'}</p>
                <p className="truncate text-sm text-muted-foreground">{d.address ?? '—'} · {formatPrice(d.codAmount)}</p>
              </div>
              <Button size="sm" onClick={() => { setActiveId(d.id); setScannedToken(null); }}>Ouvrir</Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {doneList.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Historique</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {groupByDay(doneList, (d) => d.deliveredAt).map((g) => {
              const dayCod = g.items.reduce((s, d) => s + d.codAmount, 0);
              return (
                <div key={g.key} className="space-y-2">
                  <div className="flex items-center justify-between border-b pb-1">
                    <span className="text-sm font-medium capitalize">{g.label}</span>
                    <span className="text-sm text-muted-foreground">COD {formatPrice(dayCod)}</span>
                  </div>
                  {g.items.map((d) => (
                    <div key={d.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                      <span className="truncate">{d.clientName ?? 'Client'}</span>
                      <span className="text-muted-foreground">{formatPrice(d.codAmount)}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Dialog open={scanOpen} onOpenChange={setScanOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Scanner le QR du client</DialogTitle>
            <DialogDescription>Visez le code QR affiché par le client pour valider la livraison.</DialogDescription>
          </DialogHeader>
          <QrScanner active={scanOpen} onScan={handleScanned} onError={(msg) => toast.error(msg)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setScanOpen(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={failOpen} onOpenChange={setFailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Raison de l&apos;échec</DialogTitle>
            <DialogDescription>Indiquez pourquoi la livraison n&apos;a pas pu aboutir.</DialogDescription>
          </DialogHeader>
          <Textarea placeholder="Client absent, adresse introuvable…" value={failReason} onChange={(e) => setFailReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setFailOpen(false)}>Annuler</Button>
            <Button variant="destructive" onClick={() => active && handleFail(active.id)}>Confirmer l&apos;échec</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function isToday(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const n = new Date();
  return d.getDate() === n.getDate() && d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
}
