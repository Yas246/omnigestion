'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuth } from '@/lib/auth-context';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useInvoicesRealtime } from '@/lib/api/hooks/useInvoices';
import { useClientCreditsRealtime } from '@/lib/api/hooks/useClientCredits';
import { useProductsRealtime } from '@/lib/api/hooks/useProducts';
import { useCashRegistersRealtime } from '@/lib/api/hooks/useCashRegisters';
import { useCashMovementsRealtime } from '@/lib/api/hooks/useCashMovements';
import { useAiReports, useAiReportsMutations, type AiReportDto } from '@/lib/api/hooks/useAiReports';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Loader2, Printer, AlertCircle, KeyRound, RefreshCw, Brain, Save, Trash2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { compileReportSummary, periodRange, type PeriodType } from '@/lib/ai/report-data';
import { buildReportMessages } from '@/lib/ai/report-prompt';
import { callDeepSeek, getDeepSeekKey } from '@/lib/ai/deepseek';
import { Markdown, stripFences } from '@/lib/ai/markdown';
import { printReport } from '@/lib/ai/print';

const PERIOD_OPTIONS: { value: PeriodType; label: string }[] = [
  { value: 'today', label: "Aujourd'hui" },
  { value: 'week', label: 'Cette semaine' },
  { value: 'month', label: 'Ce mois' },
  { value: 'quarter', label: 'Ce trimestre' },
  { value: 'year', label: 'Cette année' },
  { value: 'custom', label: 'Période personnalisée' },
];

interface ActiveReport {
  id?: number;
  title: string;
  periodLabel: string;
  periodStart: string | null;
  periodEnd: string | null;
  content: string;
  saved: boolean;
}

export default function AnalyseIAPage() {
  const router = useRouter();
  const { hasPermission, getFirstAccessiblePage } = usePermissions();
  const { currentCompany } = useAuth();

  const { invoices } = useInvoicesRealtime();
  const { credits, payments } = useClientCreditsRealtime();
  const { products } = useProductsRealtime();
  const { cashRegisters } = useCashRegistersRealtime();
  const { movements } = useCashMovementsRealtime();
  const { reports } = useAiReports();
  const { saveReport, deleteReport, isSaving } = useAiReportsMutations();

  const canAccess = hasPermission('reports', 'read');

  const [period, setPeriod] = useState<PeriodType>('month');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [active, setActive] = useState<ActiveReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showReasoning, setShowReasoning] = useState(false);
  const [reasoning, setReasoning] = useState('');
  const [hasKey, setHasKey] = useState(false);

  useEffect(() => {
    if (!canAccess) router.push(getFirstAccessiblePage());
  }, [canAccess, router, getFirstAccessiblePage]);

  useEffect(() => {
    setHasKey(!!getDeepSeekKey());
  }, []);

  // Restore the most recent saved report when (re)entering the page.
  useEffect(() => {
    if (reports.length && !active && !loading) {
      const r = reports[0];
      setActive({ id: r.id, title: r.title, periodLabel: r.periodLabel, periodStart: r.periodStart, periodEnd: r.periodEnd, content: r.content, saved: true });
    }
  }, [reports]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!canAccess) return null;

  const currency = (currentCompany as any)?.currency || 'FCFA';
  const companyName = (currentCompany as any)?.name ?? 'Mon entreprise';

  const currentRange = periodRange(
    period,
    from || to ? { from: from ? new Date(from) : undefined, to: to ? new Date(to) : undefined } : undefined,
  );

  const handleGenerate = async () => {
    setError('');
    if (!getDeepSeekKey()) {
      setError('Configurez votre clé API DeepSeek dans Paramètres › Intelligence.');
      return;
    }
    if (period === 'custom' && !from) {
      setError('Sélectionnez une date de début pour la période personnalisée.');
      return;
    }
    setLoading(true);
    setActive(null);
    setReasoning('');
    setShowReasoning(false);
    try {
      const summary = compileReportSummary({
        period,
        customRange: { from: from ? new Date(from) : undefined, to: to ? new Date(to) : undefined },
        invoices,
        creditPayments: payments,
        credits,
        products,
        cashMovements: movements,
        cashRegisters,
        currency,
      });
      const res = await callDeepSeek({ messages: buildReportMessages(summary) });
      const content = stripFences(res.content);
      if (!content.trim()) throw new Error("Le modèle n'a renvoyé aucun contenu. Réessayez.");
      setActive({
        title: `${companyName} — ${currentRange.name}`,
        periodLabel: currentRange.name,
        periodStart: format(currentRange.start, 'yyyy-MM-dd'),
        periodEnd: format(currentRange.end, 'yyyy-MM-dd'),
        content,
        saved: false,
      });
      setReasoning(res.reasoning ?? '');
      toast.success('Rapport généré');
    } catch (e: any) {
      setError(e?.message ?? 'Échec de la génération du rapport.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!active || active.saved) return;
    try {
      const created = await saveReport({
        title: active.title,
        periodLabel: active.periodLabel,
        periodStart: active.periodStart,
        periodEnd: active.periodEnd,
        content: active.content,
        model: 'deepseek-v4-flash',
      });
      setActive((a) => (a ? { ...a, id: (created as any)?.id ?? a.id, saved: true } : a));
      toast.success('Rapport enregistré');
    } catch (e: any) {
      toast.error(e?.message ?? "Échec de l'enregistrement");
    }
  };

  const handleOpen = (r: AiReportDto) => {
    setActive({ id: r.id, title: r.title, periodLabel: r.periodLabel, periodStart: r.periodStart, periodEnd: r.periodEnd, content: r.content, saved: true });
    setReasoning('');
    setError('');
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteReport(id);
      if (active?.id === id) setActive(null);
      toast.success('Rapport supprimé');
    } catch (e: any) {
      toast.error(e?.message ?? 'Échec de la suppression');
    }
  };

  const handlePrint = () => {
    if (!active) return;
    printReport({ companyName, periodLabel: active.periodLabel, contentMd: active.content });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Analyses"
        title="Analyse IA"
        description="Génère un rapport de gestion lisible à partir de vos données (DeepSeek, thinking activé)."
      >
        <Button onClick={handleGenerate} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          {active ? 'Régénérer' : 'Générer le rapport'}
        </Button>
      </PageHeader>

      {/* No-key banner */}
      {!hasKey && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col items-start gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <KeyRound className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Clé API DeepSeek requise</p>
                <p className="text-sm text-muted-foreground">
                  Ajoutez votre clé dans les paramètres pour activer l’analyse. Elle reste dans votre navigateur.
                </p>
              </div>
            </div>
            <Button asChild variant="outline">
              <Link href="/settings?tab=ai">Configurer la clé</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        {/* Main column */}
        <div className="space-y-6">
          {/* Period selector */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Période analysée</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Période</Label>
                <Select value={period} onValueChange={(v) => setPeriod(v as PeriodType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERIOD_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {period === 'custom' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="from">Du</Label>
                    <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="to">Au</Label>
                    <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Error */}
          {error && (
            <Card className="border-destructive/40">
              <CardContent className="flex items-start gap-3 py-4 text-destructive">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                <span className="text-sm">{error}</span>
              </CardContent>
            </Card>
          )}

          {/* Loading */}
          {loading && (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12">
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  DeepSeek analyse vos données et rédige le rapport (thinking activé)…
                </p>
                <p className="text-xs text-muted-foreground/70">Quelques dizaines de secondes, merci de patienter.</p>
              </CardContent>
            </Card>
          )}

          {/* Active report */}
          {!loading && active && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Rapport · {active.periodLabel}</CardTitle>
                <div className="flex flex-wrap gap-2">
                  {!active.saved && (
                    <Button variant="outline" size="sm" onClick={handleSave} disabled={isSaving}>
                      {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      Enregistrer
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={handleGenerate} disabled={loading}>
                    <RefreshCw className="mr-2 h-4 w-4" /> Régénérer
                  </Button>
                  <Button size="sm" onClick={handlePrint}>
                    <Printer className="mr-2 h-4 w-4" /> Imprimer / PDF
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {active.saved && (
                  <p className="mb-3 text-xs text-muted-foreground">Rapport enregistré · {active.title}</p>
                )}
                <Markdown content={active.content} className="max-w-none" />

                {reasoning && (
                  <div className="mt-6 border-t pt-4">
                    <button
                      type="button"
                      onClick={() => setShowReasoning((v) => !v)}
                      className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground"
                    >
                      <Brain className="h-3.5 w-3.5" />
                      Chaîne de réflexion (thinking)
                    </button>
                    {showReasoning && (
                      <pre className="mt-3 max-h-80 overflow-y-auto whitespace-pre-wrap rounded-md bg-muted/60 p-4 text-xs leading-relaxed text-muted-foreground">
                        {reasoning}
                      </pre>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Empty */}
          {!loading && !active && !error && (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Sparkles className="h-6 w-6" />
                </div>
                <p className="font-medium">Aucun rapport à afficher</p>
                <p className="max-w-md text-sm text-muted-foreground">
                  Choisissez une période et cliquez sur « Générer le rapport ». L’IA analyse vos ventes,
                  votre rentabilité, votre stock et votre caisse pour produire un compte-rendu clair.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* History sidebar */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground/70">Rapports enregistrés</h2>
          </div>
          {reports.length === 0 ? (
            <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
              Aucun rapport enregistré pour l’instant.
            </p>
          ) : (
            <div className="space-y-2">
              {reports.map((r) => {
                const isActive = active?.id === r.id;
                return (
                  <div
                    key={r.id}
                    className={`group rounded-lg border bg-card p-3 transition-colors ${
                      isActive ? 'border-primary/50 bg-primary/5' : 'hover:bg-accent'
                    }`}
                  >
                    <button type="button" onClick={() => handleOpen(r)} className="block w-full text-left">
                      <p className="truncate text-sm font-medium">{r.periodLabel}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {r.createdAt ? format(new Date(r.createdAt), 'dd MMM yyyy, HH:mm', { locale: fr }) : ''}
                      </p>
                    </button>
                    <div className="mt-2 flex items-center gap-1">
                      <Button variant="ghost" size="xs" onClick={() => handleOpen(r)}>
                        Ouvrir
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(r.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
