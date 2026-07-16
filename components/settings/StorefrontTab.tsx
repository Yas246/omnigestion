'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useStorefront } from '@/lib/api/hooks/useStorefront';
import { useProductsRealtime } from '@/lib/api/hooks/useProducts';
import { StorefrontRenderer } from '@/components/storefront/StorefrontRenderer';
import { FONT_PAIRS, DEFAULT_FONT_SENTINEL } from '@/components/storefront/font-pairs';
import type { StorefrontConfig, StorefrontProduct, StorefrontCompany } from '@/components/storefront/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ExternalLink, Save, Rocket, Palette, Layout, Maximize2, X, ChevronUp, ChevronDown, Type } from 'lucide-react';

const TEMPLATES = [
  { id: 'minimal', name: 'Minimal', description: 'Galerie — index texte, minimalisme absolu' },
  { id: 'boutique', name: 'Boutique', description: 'Lookbook — magazine de mode, plein écran' },
  { id: 'marche', name: 'Marché', description: 'Chaleureux — cartes douces, coup de cœur' },
  { id: 'studio', name: 'Studio', description: 'Atelier — sombre, cinématique, rail horizontal' },
];

const SECTION_LABELS: Record<string, string> = {
  products: 'Produits',
  categories: 'Catégories',
  about: 'À propos',
  contact: 'Contact',
};

export function StorefrontTab() {
  const { storefront, isLoading, save, publish, setSlug, setEnabled } = useStorefront();
  const { products: realProducts } = useProductsRealtime();
  const [draft, setDraft] = useState<StorefrontConfig | null>(null);
  const [slugInput, setSlugInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (storefront?.config) {
      setDraft(storefront.config);
      setSlugInput(storefront.slug ?? '');
    }
  }, [storefront?.config, storefront?.slug]);

  // Real products for the preview — published first, fallback to all (so the
  // preview is never empty when the merchant has a catalog but hasn't published yet).
  const published = realProducts.filter((p) => p.published);
  const previewProducts: StorefrontProduct[] = (published.length > 0 ? published : realProducts)
    .slice(0, 12)
    .map((p) => ({
      id: Number(p.id),
      name: p.name,
      code: p.code ?? null,
      category: p.category ?? null,
      description: p.description ?? null,
      retailPrice: p.retailPrice,
      mainImageUrl: p.mainImageUrl ?? null,
      unit: p.unit ?? null,
      images: [],
    }));

  if (isLoading || !storefront || !draft) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const previewCompany: StorefrontCompany = {
    id: 0,
    name: storefront.companyName ?? 'Ma boutique',
    slogan: storefront.slogan ?? null,
    description: storefront.description ?? null,
    logoUrl: storefront.logoUrl,
    bannerUrl: storefront.bannerUrl,
    phone: '+000000000',
    email: 'contact@boutique.test',
    address: 'Adresse exemple',
    currency: 'FCFA',
    storeSlug: storefront.slug,
  };

  const update = (patch: Partial<StorefrontConfig>) => setDraft((d) => ({ ...d!, ...patch }));
  const updateColor = (key: keyof StorefrontConfig['colors'], value: string) =>
    setDraft((d) => ({ ...d!, colors: { ...d!.colors, [key]: value } }));
  const updateHero = (patch: Partial<StorefrontConfig['hero']>) =>
    setDraft((d) => ({ ...d!, hero: { ...d!.hero, ...patch } }));
  const toggleSection = (type: string) =>
    setDraft((d) => ({
      ...d!,
      sections: d!.sections.map((s) => (s.type === type ? { ...s, enabled: !s.enabled } : s)),
    }));
  const moveSection = (index: number, dir: -1 | 1) =>
    setDraft((d) => {
      const arr = [...d!.sections];
      const target = index + dir;
      if (target < 0 || target >= arr.length) return d!;
      [arr[index], arr[target]] = [arr[target], arr[index]];
      return { ...d!, sections: arr };
    });

  const handleSave = async () => {
    setSaving(true);
    try {
      await save({ template: draft.template, config: draft });
      toast.success('Brouillon enregistré');
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    setSaving(true);
    try {
      await save({ template: draft.template, config: draft });
      await publish();
      toast.success('Vitrine publiée 🎉');
    } catch (e: any) {
      toast.error(e?.message || 'Erreur lors de la publication');
    } finally {
      setSaving(false);
    }
  };

  const handleSlugBlur = async () => {
    if (slugInput && slugInput !== storefront.slug) {
      try {
        await setSlug(slugInput.trim().toLowerCase());
        toast.success('URL mise à jour');
      } catch (e: any) {
        toast.error(e?.message || 'Slug invalide ou déjà pris');
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Top bar: enable + slug + actions */}
      <Card>
        <CardContent className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Switch
              checked={storefront.enabled}
              onCheckedChange={(v) =>
                setEnabled(v).then(() => toast.success(v ? 'Vitrine activée' : 'Vitrine désactivée'))
              }
            />
            <div>
              <Label className="font-medium">Vitrine {storefront.enabled ? 'active' : 'inactive'}</Label>
              <p className="text-xs text-muted-foreground">Activez pour la rendre publique</p>
            </div>
          </div>
          <div className="flex items-end gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="slug" className="text-xs">URL publique</Label>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">/store/</span>
                <Input
                  id="slug"
                  value={slugInput}
                  onChange={(e) => setSlugInput(e.target.value)}
                  onBlur={handleSlugBlur}
                  className="h-8 w-40"
                />
              </div>
            </div>
            {storefront.enabled && storefront.slug && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/store/${storefront.slug}`} target="_blank">
                  <ExternalLink className="mr-1 h-4 w-4" /> Voir
                </Link>
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSave} disabled={saving}>
              <Save className="mr-1 h-4 w-4" /> Enregistrer
            </Button>
            <Button onClick={handlePublish} disabled={saving}>
              {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Rocket className="mr-1 h-4 w-4" />}
              Publier
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Customizer */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Layout className="h-4 w-4" /> Template
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => update({ template: t.id })}
                  className={`rounded-lg border-2 p-3 text-left transition-colors ${
                    draft.template === t.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent'
                  }`}
                >
                  <div className="text-sm font-medium">{t.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{t.description}</div>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Palette className="h-4 w-4" /> Couleurs
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              {(
                [
                  ['primary', 'Primaire'],
                  ['accent', 'Accent'],
                  ['background', 'Fond'],
                  ['text', 'Texte'],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="flex items-center gap-2">
                  <input
                    type="color"
                    value={draft.colors[key]}
                    onChange={(e) => updateColor(key, e.target.value)}
                    className="h-9 w-12 cursor-pointer rounded border"
                  />
                  <Label className="text-sm">{label}</Label>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Font pairing selector */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Type className="h-4 w-4" /> Polices
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={draft.fontPair || DEFAULT_FONT_SENTINEL}
                onValueChange={(v) => update({ fontPair: v === DEFAULT_FONT_SENTINEL ? undefined : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Par défaut du template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DEFAULT_FONT_SENTINEL}>Par défaut ({TEMPLATES.find(t => t.id === draft.template)?.name})</SelectItem>
                  {Object.entries(FONT_PAIRS).map(([key, pair]) => (
                    <SelectItem key={key} value={key}>{pair.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-2 text-xs text-muted-foreground">Surcharge les polices du template.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bannière (Hero)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Afficher la bannière</Label>
                <Switch checked={draft.hero.enabled} onCheckedChange={(v) => updateHero({ enabled: v })} />
              </div>
              <div>
                <Label className="text-xs">Titre</Label>
                <Input value={draft.hero.title || ''} onChange={(e) => updateHero({ title: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Sous-titre</Label>
                <Input value={draft.hero.subtitle || ''} onChange={(e) => updateHero({ subtitle: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Texte du bouton (CTA)</Label>
                <Input value={draft.hero.cta || ''} onChange={(e) => updateHero({ cta: e.target.value })} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sections (ordre + visibilité)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {draft.sections.map((s, i) => (
                <div key={s.type} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <Label className="text-sm">{SECTION_LABELS[s.type] ?? s.type}</Label>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => moveSection(i, -1)}
                      disabled={i === 0}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => moveSection(i, 1)}
                      disabled={i === draft.sections.length - 1}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <Switch checked={s.enabled} onCheckedChange={() => toggleSection(s.type)} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Affichage produits</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Afficher les prix</Label>
                <Switch
                  checked={draft.productDisplay.showPrice}
                  onCheckedChange={(v) => update({ productDisplay: { ...draft.productDisplay, showPrice: v } })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Colonnes (grand écran)</Label>
                <Select
                  value={String(draft.productDisplay.columns)}
                  onValueChange={(v) =>
                    update({ productDisplay: { ...draft.productDisplay, columns: Number(v) } })
                  }
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="3">3</SelectItem>
                    <SelectItem value="4">4</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pied de page</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Texte du footer</Label>
                <Textarea
                  rows={2}
                  value={draft.footer.text || ''}
                  onChange={(e) => update({ footer: { ...draft.footer, text: e.target.value } })}
                  placeholder="Conditions, mention légale…"
                />
              </div>
              {(
                [
                  ['facebook', 'Facebook'],
                  ['instagram', 'Instagram'],
                  ['whatsapp', 'WhatsApp'],
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <Label className="text-xs">{label}</Label>
                  <Input
                    value={draft.footer.social[key] ?? ''}
                    onChange={(e) =>
                      update({ footer: { ...draft.footer, social: { ...draft.footer.social, [key]: e.target.value } } })
                    }
                    placeholder={`Lien ${label}`}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Preview */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 py-3">
              <CardTitle className="text-sm text-muted-foreground">Aperçu en direct</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setFullscreen(true)}>
                <Maximize2 className="mr-1 h-4 w-4" /> Plein écran
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-175 overflow-y-auto border-t">
                <StorefrontRenderer company={previewCompany} config={draft} products={previewProducts} />
              </div>
            </CardContent>
          </Card>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Aperçu sur {previewProducts.length} produit{previewProducts.length > 1 ? 's' : ''}
            {published.length > 0 ? ' (publiés)' : ' (aucun publié — tous affichés)'}
          </p>
        </div>
      </div>

      {/* Fullscreen preview — clean overlay (toolbar + renderer, no Dialog chrome) */}
      {fullscreen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <div className="flex items-center justify-between border-b px-4 py-2">
            <span className="text-sm font-medium">
              Aperçu — brouillon{published.length > 0 ? '' : ' (aucun produit publié)'}
            </span>
            <Button variant="ghost" size="sm" onClick={() => setFullscreen(false)}>
              <X className="mr-1 h-4 w-4" /> Quitter l&apos;aperçu
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <StorefrontRenderer company={previewCompany} config={draft} products={previewProducts} />
          </div>
        </div>
      )}
    </div>
  );
}
