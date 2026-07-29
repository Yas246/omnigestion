'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/page-header';
import { KpiCard, KpiCardHeader, KpiCardValue } from '@/components/ui/kpi-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Truck, Plus, MapPin, Play, CheckCircle2, Ban } from 'lucide-react';
import { formatPrice, groupByDay } from '@/lib/format';
import {
  useDeliveriesRealtime,
  usePendingInvoices,
  useDrivers,
  useDeliveryLive,
  useDeliveryPerformance,
  useSettlements,
  useDeliveries,
  type DeliveryDto,
  type DeliveryStatus,
  type PendingInvoiceDto,
} from '@/lib/api/hooks/useDeliveries';
import { usePermissions } from '@/lib/hooks/usePermissions';

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
const STATUS_VARIANT: Record<DeliveryStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'secondary',
  assigned: 'default',
  picked_up: 'default',
  in_transit: 'default',
  delivered: 'default',
  failed: 'destructive',
  cancelled: 'outline',
};

export default function DeliveriesPage() {
  const { isAdmin, canCreateDelivery, canAssignDelivery } = usePermissions();
  const { deliveries } = useDeliveriesRealtime();
  const { pendingInvoices } = usePendingInvoices();
  const { drivers } = useDrivers();
  const { live } = useDeliveryLive();
  const { performance } = useDeliveryPerformance();
  const { settlements } = useSettlements();
  const m = useDeliveries();

  const [createOpen, setCreateOpen] = useState(false);
  const [createInvoiceId, setCreateInvoiceId] = useState<string>('');
  const [createAddress, setCreateAddress] = useState('');

  const buckets = useMemo(() => {
    const by = (s: DeliveryStatus[]) => deliveries.filter((d) => s.includes(d.status));
    return {
      pending: by(['pending']),
      active: by(['assigned', 'picked_up', 'in_transit']),
      delivered: by(['delivered']),
      failed: by(['failed', 'cancelled']),
    };
  }, [deliveries]);

  const todayCod = useMemo(
    () => buckets.delivered.filter((d) => isToday(d.deliveredAt)).reduce((s, d) => s + d.codAmount, 0),
    [buckets.delivered]
  );

  const handleCreate = async () => {
    const invoiceId = Number(createInvoiceId);
    if (!invoiceId || Number.isNaN(invoiceId)) return toast.error('Choisissez une commande');
    try {
      await m.createDelivery({ invoiceId, address: createAddress || undefined });
      toast.success('Livraison créée');
      setCreateOpen(false);
      setCreateInvoiceId('');
      setCreateAddress('');
    } catch (e: any) {
      toast.error(e.message || 'Erreur');
    }
  };

  const handleAssign = async (id: number, driverUserId: number) => {
    try {
      await m.assignDelivery({ id, driverUserId });
      toast.success('Livreur attribué');
    } catch (e: any) {
      toast.error(e.message || 'Erreur');
    }
  };

  // One-click: turn a pending storefront order into a delivery (auto-resolving
  // the buyer's default address server-side) and immediately attribute a driver.
  const handleCreateAndAssign = async (invoiceId: number, driverUserId: number) => {
    try {
      const created: any = await m.createDelivery({ invoiceId });
      const deliveryId = Number(created?.id);
      if (!deliveryId || Number.isNaN(deliveryId)) throw new Error('Livraison non créée');
      await m.assignDelivery({ id: deliveryId, driverUserId });
      toast.success('Livraison créée et attribuée');
    } catch (e: any) {
      toast.error(e.message || 'Erreur');
    }
  };

  // Régulariser la tournée d'un livreur en une action : on crée le compte de
  // tournée (couvre toutes ses livraisons livrées non soldées) puis on le valide
  // immédiatement. À écart 0, la caisse est créditée et les livraisons soldées.
  const handleSettle = async (driverUserId: number, cash: number, mobile: number) => {
    try {
      const created: any = await m.createSettlement({ driverUserId, actualCash: cash, actualMobile: mobile });
      if (!created?.id) throw new Error('Compte non créé');
      await m.validateSettlement({ id: created.id, actualCash: cash, actualMobile: mobile });
      toast.success('Tournée régularisée — caisse créditée');
    } catch (e: any) {
      toast.error(e.message || 'Erreur');
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <PageHeader
        title="Livraisons"
        description="Attribuez les commandes de la vitrine aux livreurs et suivez les tournées."
      >
        {(isAdmin || canCreateDelivery()) && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Créer une livraison
          </Button>
        )}
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard>
          <KpiCardHeader title="À attribuer" icon={<Truck className="h-4 w-4" />} />
          <KpiCardValue value={String(pendingInvoices.length + buckets.pending.length)} />
        </KpiCard>
        <KpiCard>
          <KpiCardHeader title="En cours" icon={<MapPin className="h-4 w-4" />} />
          <KpiCardValue value={String(buckets.active.length)} />
        </KpiCard>
        <KpiCard variant="success">
          <KpiCardHeader title="Livrées" icon={<CheckCircle2 className="h-4 w-4" />} iconVariant="success" />
          <KpiCardValue value={String(buckets.delivered.length)} variant="success" />
        </KpiCard>
        <KpiCard variant="info">
          <KpiCardHeader title="COD du jour" icon={<Play className="h-4 w-4" />} iconVariant="info" />
          <KpiCardValue value={formatPrice(todayCod)} variant="info" />
        </KpiCard>
      </div>

      <Tabs defaultValue="pending">
        <TabsList className="flex w-full flex-wrap">
          <TabsTrigger value="pending">À attribuer ({pendingInvoices.length + buckets.pending.length})</TabsTrigger>
          <TabsTrigger value="active">En cours ({buckets.active.length})</TabsTrigger>
          <TabsTrigger value="delivered">Terminées ({buckets.delivered.length})</TabsTrigger>
          <TabsTrigger value="failed">Échouées ({buckets.failed.length})</TabsTrigger>
          <TabsTrigger value="map">Carte live</TabsTrigger>
          <TabsTrigger value="settlements">Comptes</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          <PendingInvoiceList
            items={pendingInvoices}
            drivers={drivers}
            canAssign={isAdmin || canCreateDelivery()}
            onCreateAndAssign={handleCreateAndAssign}
          />
          <div>
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">Prêtes à attribuer un livreur</h3>
            <DeliveryList
              items={buckets.pending}
              drivers={drivers}
              canAssign={isAdmin || canAssignDelivery()}
              onAssign={handleAssign}
              onCancel={(id) => m.cancelDelivery(id).then(() => toast.success('Annulée')).catch((e) => toast.error(e.message))}
            />
          </div>
        </TabsContent>
        <TabsContent value="active">
          <DeliveryList items={buckets.active} drivers={drivers} canAssign={false} onAssign={() => {}} onCancel={() => {}} />
        </TabsContent>
        <TabsContent value="delivered" className="space-y-4">
          {buckets.delivered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Aucune livraison ici.</p>
          ) : (
            groupByDay(buckets.delivered, (d) => d.deliveredAt).map((g) => {
              const dayCod = g.items.reduce((s, d) => s + d.codAmount, 0);
              return (
                <div key={g.key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium capitalize text-muted-foreground">{g.label}</h3>
                    <span className="text-sm text-muted-foreground">COD {formatPrice(dayCod)}</span>
                  </div>
                  <DeliveryList items={g.items} drivers={drivers} canAssign={false} onAssign={() => {}} onCancel={() => {}} />
                </div>
              );
            })
          )}
        </TabsContent>
        <TabsContent value="failed">
          <DeliveryList items={buckets.failed} drivers={drivers} canAssign={false} onAssign={() => {}} onCancel={() => {}} />
        </TabsContent>

        <TabsContent value="map">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4" /> Position live des livreurs
              </CardTitle>
            </CardHeader>
            <CardContent>
              {live.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune livraison en cours.</p>
              ) : (
                <DeliveryMap
                  height={420}
                  driver={firstDriverPos(live)}
                />
              )}
              <div className="mt-3 space-y-2">
                {live.map((l: any) => (
                  <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm">
                    <div>
                      <span className="font-medium">{l.clientName ?? 'Client'}</span>
                      <span className="ml-2 text-muted-foreground">{l.driverName ?? '—'}</span>
                    </div>
                    <Badge variant={STATUS_VARIANT[(l.status as DeliveryStatus) ?? 'in_transit']}>
                      {STATUS_LABEL[(l.status as DeliveryStatus) ?? 'in_transit']}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settlements">
          <SettlementsPanel
            settlements={settlements}
            performance={performance}
            canValidate={isAdmin || canAssignDelivery()}
            drivers={drivers}
            onSettle={handleSettle}
            onValidate={(id, cash, mobile) =>
              m.validateSettlement({ id, actualCash: cash, actualMobile: mobile }).then(() => toast.success('Compte validé')).catch((e) => toast.error(e.message))
            }
          />
        </TabsContent>
      </Tabs>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer une livraison</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Commande vitrine</Label>
              <Select value={createInvoiceId} onValueChange={setCreateInvoiceId}>
                <SelectTrigger><SelectValue placeholder="Choisir une commande impayée…" /></SelectTrigger>
                <SelectContent>
                  {pendingInvoices.length === 0 ? (
                    <SelectItem value="_none" disabled>Aucune commande en attente</SelectItem>
                  ) : (
                    pendingInvoices.map((inv) => (
                      <SelectItem key={inv.id} value={String(inv.id)}>
                        {inv.invoiceNumber} — {inv.clientName ?? 'Client'} ({formatPrice(inv.codAmount)})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Adresse de livraison (optionnel)</Label>
              <Input placeholder="Quartier, rue, repère…" value={createAddress} onChange={(e) => setCreateAddress(e.target.value)} />
              <p className="text-xs text-muted-foreground">Géocodée automatiquement si non précisée par l&apos;acheteur.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button onClick={handleCreate}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function firstDriverPos(live: any[]): { latitude: number; longitude: number; label: string } | null {
  const l = live.find((x) => x.position);
  if (!l?.position) return null;
  return { latitude: l.position.latitude, longitude: l.position.longitude, label: 'Livreur' };
}

function PendingInvoiceList({
  items,
  drivers,
  canAssign,
  onCreateAndAssign,
}: {
  items: PendingInvoiceDto[];
  drivers: { id: number; fullName: string; isOwner: boolean }[];
  canAssign: boolean;
  onCreateAndAssign: (invoiceId: number, driverUserId: number) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-muted-foreground">Commandes en attente de livraison</h3>
      <div className="space-y-2">
        {items.map((inv) => (
          <Card key={inv.id}>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">À préparer</Badge>
                  <span className="font-medium">{inv.clientName ?? 'Client'}</span>
                  <span className="text-sm text-muted-foreground">· {inv.invoiceNumber}</span>
                </div>
                <p className="text-xs text-muted-foreground">{new Date(inv.date).toLocaleDateString()}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">COD</p>
                  <p className="font-semibold">{formatPrice(inv.codAmount)}</p>
                </div>
                {canAssign && (
                  <Select onValueChange={(v) => onCreateAndAssign(inv.id, Number(v))}>
                    <SelectTrigger className="w-45"><SelectValue placeholder="Attribuer à…" /></SelectTrigger>
                    <SelectContent>
                      {drivers.map((dr) => (
                        <SelectItem key={dr.id} value={String(dr.id)}>
                          {dr.fullName}{dr.isOwner ? ' (admin)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function DeliveryList({
  items,
  drivers,
  canAssign,
  onAssign,
  onCancel,
}: {
  items: DeliveryDto[];
  drivers: { id: number; fullName: string; isOwner: boolean }[];
  canAssign: boolean;
  onAssign: (id: number, driverUserId: number) => void;
  onCancel: (id: number) => void;
}) {
  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Aucune livraison ici.</p>;
  }
  return (
    <div className="space-y-2">
      {items.map((d) => (
        <Card key={d.id}>
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={STATUS_VARIANT[d.status]}>{STATUS_LABEL[d.status]}</Badge>
                <span className="font-medium">{d.clientName ?? 'Client'}</span>
                {d.driverName && <span className="text-sm text-muted-foreground">· {d.driverName}</span>}
              </div>
              <p className="truncate text-sm text-muted-foreground">
                {d.address ? (<><MapPin className="mr-1 inline h-3 w-3" />{d.address}</>) : 'Adresse non précisée'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">COD</p>
                <p className="font-semibold">{formatPrice(d.codAmount)}</p>
              </div>
              {canAssign && d.status === 'pending' && (
                <>
                  <Select onValueChange={(v) => onAssign(d.id, Number(v))}>
                    <SelectTrigger className="w-45"><SelectValue placeholder="Attribuer à…" /></SelectTrigger>
                    <SelectContent>
                      {drivers.map((dr) => (
                        <SelectItem key={dr.id} value={String(dr.id)}>
                          {dr.fullName}{dr.isOwner ? ' (admin)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" onClick={() => onCancel(d.id)} title="Annuler">
                    <Ban className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function SettlementsPanel({
  settlements,
  performance,
  canValidate,
  onValidate,
  onSettle,
  drivers,
}: {
  settlements: any[];
  performance: any[];
  canValidate: boolean;
  onValidate: (id: number, cash: number, mobile: number) => void;
  onSettle: (driverUserId: number, cash: number, mobile: number) => void;
  drivers: { id: number; fullName: string }[];
}) {
  const [settleFor, setSettleFor] = useState<{ id: number; name: string; expected: number } | null>(null);
  const [cash, setCash] = useState('0');
  const [mobile, setMobile] = useState('0');

  const perfById = new Map(performance.map((p: any) => [p.driverUserId, p]));

  const openSettle = (dr: { id: number; fullName: string }) => {
    const p = perfById.get(dr.id);
    setSettleFor({ id: dr.id, name: dr.fullName, expected: p?.unsettledCod ?? 0 });
    setCash('0');
    setMobile('0');
  };

  const confirmSettle = () => {
    if (!settleFor) return;
    onSettle(settleFor.id, Number(cash) || 0, Number(mobile) || 0);
    setSettleFor(null);
  };

  const expected = settleFor?.expected ?? 0;
  const diff = expected - (Number(cash) || 0) - (Number(mobile) || 0);

  return (
    <div className="space-y-4">
      {/* À régulariser par livreur : clôture en un clic */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">À régulariser par livreur</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {drivers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun livreur.</p>
          ) : (
            drivers.map((dr) => {
              const p = perfById.get(dr.id);
              const count = p?.unsettledCount ?? 0;
              const cod = p?.unsettledCod ?? 0;
              return (
                <div key={dr.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm">
                  <div className="min-w-0">
                    <span className="font-medium">{dr.fullName}</span>
                    <span className="ml-2 text-muted-foreground">
                      {count > 0 ? `${count} à régulariser · COD ${formatPrice(cod)}` : 'Rien à régulariser'}
                    </span>
                  </div>
                  <Button size="sm" disabled={!canValidate || count === 0} onClick={() => openSettle(dr)}>
                    Régulariser
                  </Button>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Historique des clôtures passées */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historique des clôtures</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {settlements.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune clôture pour le moment.</p>
          ) : (
            settlements.map((s) => <SettlementRow key={s.id} s={s} canValidate={canValidate} onValidate={onValidate} />)
          )}
        </CardContent>
      </Card>

      {/* Dialogue de régularisation : attendu + remis → valider en un clic */}
      <Dialog open={!!settleFor} onOpenChange={(o) => !o && setSettleFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Régulariser la tournée — {settleFor?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md bg-muted/40 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">COD attendu (livraisons non soldées)</span>
                <span className="font-semibold">{formatPrice(expected)}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Remis en espèces</Label>
                <Input type="number" value={cash} onChange={(e) => setCash(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Remis en mobile</Label>
                <Input type="number" value={mobile} onChange={(e) => setMobile(e.target.value)} />
              </div>
            </div>
            <p className={`text-xs ${diff === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
              {diff === 0
                ? 'Écart = 0 : la caisse sera créditée et les livraisons soldées.'
                : `Écart de ${formatPrice(Math.abs(diff))} (${diff > 0 ? 'manquant' : 'excédent'}) — sera marqué « discrepancy ».`}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettleFor(null)}>Annuler</Button>
            <Button onClick={confirmSettle}>Valider la régularisation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SettlementRow({ s, canValidate, onValidate }: { s: any; canValidate: boolean; onValidate: (id: number, cash: number, mobile: number) => void }) {
  const [cash, setCash] = useState(String(s.actualCash ?? 0));
  const [mobile, setMobile] = useState(String(s.actualMobile ?? 0));
  const submitted = s.status === 'submitted' || s.status === 'open';
  return (
    <div className="rounded-md border p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-medium">{s.driverName ?? '—'}</span>
          <Badge className="ml-2" variant={s.status === 'validated' ? 'default' : s.status === 'discrepancy' ? 'destructive' : 'secondary'}>
            {s.status}
          </Badge>
        </div>
        <span className="text-sm text-muted-foreground">{s.deliveriesCount} livraisons · attendu {formatPrice(s.expectedCod)}</span>
      </div>
      {submitted && canValidate && (
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label className="text-xs">Espèces</Label>
            <Input className="w-32" type="number" value={cash} onChange={(e) => setCash(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Mobile</Label>
            <Input className="w-32" type="number" value={mobile} onChange={(e) => setMobile(e.target.value)} />
          </div>
          <Button size="sm" onClick={() => onValidate(s.id, Number(cash) || 0, Number(mobile) || 0)}>
            <CheckCircle2 className="mr-1 h-4 w-4" /> Valider
          </Button>
        </div>
      )}
    </div>
  );
}

function isToday(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const n = new Date();
  return d.getDate() === n.getDate() && d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
}
