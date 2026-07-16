'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FileSpreadsheet, Check, X, AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { api } from '@/lib/api/client';
import { useAuth } from '@/lib/auth-context';
import { useSettings } from '@/lib/api/hooks/useSettings';
import { parseProductFile, type ParsedProduct } from '@/lib/utils/excelParser';
import type { Product } from '@/types';

interface ImportProductsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

export function ImportProductsModal({ open, onOpenChange, onImportComplete }: ImportProductsModalProps) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { settings, warehouses } = useSettings();
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'result'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [parsedProducts, setParsedProducts] = useState<ParsedProduct[]>([]);
  const [duplicates, setDuplicates] = useState(0);
  const [filter, setFilter] = useState<'all' | 'warnings'>('all');
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: number;
    errors: number;
    skipped: number;
    errorDetails: string[];
  }>({ success: 0, errors: 0, skipped: 0, errorDetails: [] });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Vérifier l'extension
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const fileExtension = '.' + selectedFile.name.split('.').pop()?.toLowerCase();

    if (!validExtensions.includes(fileExtension)) {
      toast.error('Format de fichier non supporté. Utilisez .xlsx, .xls ou .csv');
      return;
    }

    setFile(selectedFile);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files?.[0];
    if (!droppedFile) return;

    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const fileExtension = '.' + droppedFile.name.split('.').pop()?.toLowerCase();

    if (!validExtensions.includes(fileExtension)) {
      toast.error('Format de fichier non supporté. Utilisez .xlsx, .xls ou .csv');
      return;
    }

    setFile(droppedFile);
  };

  const handlePreview = async () => {
    if (!file) return;

    try {
      const result = await parseProductFile(file);

      if (result.validProducts.length === 0) {
        toast.error('Aucun produit valide trouvé dans le fichier');
        return;
      }

      // Vérifier les doublons avec la base de données
      const existingProducts = await checkForDuplicates(result.validProducts);

      setParsedProducts(result.validProducts);
      setDuplicates(existingProducts);
      setStep('preview');
    } catch (error: any) {
      console.error('Erreur lors du parsing:', error);
      toast.error(error.message || 'Erreur lors de la lecture du fichier');
    }
  };

  const checkForDuplicates = async (products: ParsedProduct[]): Promise<number> => {
    const res = await api.get<{ data: any[] } | any[]>('/products?limit=500');
    const arr = Array.isArray(res) ? res : (res as any).data ?? [];
    const existingNames = new Set((arr as any[]).map((p) => p.name?.toLowerCase()));
    return products.filter((p) => existingNames.has(p.name.toLowerCase())).length;
  };

  const handleImport = async () => {
    if (!user?.currentCompanyId || parsedProducts.length === 0) return;

    setIsImporting(true);
    setStep('importing');

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = duplicates;
    const errorDetails: string[] = [];

    try {
      const res = await api.get<{ data: any[] } | any[]>('/products?limit=500');
      const arr = Array.isArray(res) ? res : (res as any).data ?? [];
      const existingProductNames = new Set((arr as any[]).map((p) => p.name?.toLowerCase()));

      // Resolve the import depot: prefer the user-configured default depot
      // (settings.stock.defaultWarehouseId — the "Dépôt par défaut" select in
      // Settings), fall back to the main warehouse. Coherent with InvoiceService.
      const [whRes, settingsRes] = await Promise.all([
        api.get<any>('/warehouses'),
        api.get<any>('/settings').catch(() => null),
      ]);
      const whArr = Array.isArray(whRes) ? whRes : (whRes as any).data ?? [];
      const preferredId = (settingsRes as any)?.stock?.defaultWarehouseId;
      let defaultWh = preferredId
        ? whArr.find((w: any) => String(w.id) === String(preferredId))
        : null;
      if (!defaultWh) defaultWh = whArr.find((w: any) => w.isMain) ?? whArr[0];
      const defaultWarehouseId = defaultWh ? String(defaultWh.id) : null;
      console.log('[import] warehouse:', defaultWh?.name, 'id:', defaultWarehouseId);

      for (const parsedProduct of parsedProducts) {
        if (existingProductNames.has(parsedProduct.name.toLowerCase())) {
          skippedCount++;
          continue;
        }

        try {
          const created = await api.post<any>('/products', {
            name: parsedProduct.name,
            purchasePrice: Number(parsedProduct.purchasePrice) || 0,
            retailPrice: Number(parsedProduct.retailPrice) || 0,
            wholesalePrice: Number(parsedProduct.wholesalePrice) || 0,
            wholesaleThreshold: Number(parsedProduct.wholesaleThreshold) || 10,
            alertThreshold: Number(parsedProduct.alertThreshold) || 5,
            ...(parsedProduct.category ? { category: parsedProduct.category } : {}),
            unit: parsedProduct.unit || 'Pièce',
            ...(defaultWarehouseId ? { warehouseId: Number(defaultWarehouseId) } : {}),
          });

          const qty = Number(parsedProduct.quantity) || 0;
          console.log('[import]', parsedProduct.name, 'qty:', qty, 'wh:', defaultWarehouseId, 'pid:', created?.id);
          if (qty > 0 && defaultWarehouseId && created?.id) {
            await api.post('/stock/restock', {
              productId: Number(created.id),
              warehouseId: Number(defaultWarehouseId),
              quantity: qty,
            });
          }

          successCount++;
        } catch (error: any) {
          errorCount++;
          errorDetails.push(`Ligne ${parsedProduct.rowNumber}: ${error.message}`);
        }
      }

      setImportResult({
        success: successCount,
        errors: errorCount,
        skipped: skippedCount,
        errorDetails,
      });

      // Invalidate the products cache so the list refreshes without a page reload.
      qc.invalidateQueries({ queryKey: ['products'] });

      setStep('result');
      toast.success(`${successCount} produit(s) importé(s) avec succès`);

      if (successCount > 0) {
        onImportComplete();
      }
    } catch (error: any) {
      console.error('Erreur lors de l\'import:', error);
      toast.error('Erreur lors de l\'import des produits');
      setStep('preview');
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setStep('upload');
    setFile(null);
    setParsedProducts([]);
    setDuplicates(0);
    setFilter('all');
    setImportResult({ success: 0, errors: 0, skipped: 0, errorDetails: [] });
    onOpenChange(false);
  };

  const handleRemoveProduct = (index: number) => {
    setParsedProducts(prev => prev.filter((_, i) => i !== index));
  };

  const filteredProducts = filter === 'warnings'
    ? parsedProducts.filter(p => p.warnings.length > 0 || p.errors.length > 0)
    : parsedProducts;

  const productsWithWarnings = parsedProducts.filter(p => p.warnings.length > 0 || p.errors.length > 0).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-4xl max-h-screen flex flex-col overflow-hidden p-4 sm:p-6">
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle>Importer des produits</DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Importez vos produits depuis un fichier Excel ou CSV'}
            {step === 'preview' && 'Vérifiez les données avant l\'import'}
            {step === 'importing' && 'Import en cours...'}
            {step === 'result' && 'Résultat de l\'import'}
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="flex-1 min-h-0 overflow-y-auto space-y-4 py-4">
            <div
              className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-4 sm:p-8 space-y-4 transition-colors ${
                isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
              }`}
              onDragOver={handleDragOver}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <FileSpreadsheet className="h-12 w-12 text-muted-foreground" />
              <div className="text-center space-y-2">
                <p className="text-sm font-medium">Glissez-déposez votre fichier ici</p>
                <p className="text-xs text-muted-foreground">ou</p>
                <label htmlFor="file-upload" className="cursor-pointer">
                  <span className="text-sm text-primary hover:underline">Parcourir les fichiers</span>
                  <input
                    id="file-upload"
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
                <p className="text-xs text-muted-foreground">
                  Formats supportés : .xlsx, .xls, .csv
                </p>
              </div>
            </div>

            {file && (
              <Card>
                <CardContent className="py-4 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileSpreadsheet className="h-5 w-5 shrink-0 text-primary" />
                    <span className="text-sm font-medium truncate">{file.name}</span>
                    <span className="text-xs text-muted-foreground">({(file.size / 1024).toFixed(2)} KB)</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFile(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            )}

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium">Colonnes supportées :</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><Badge variant="outline">Produit</Badge> (obligatoire)</div>
                <div><Badge variant="outline">Quantité</Badge> (défaut: 0)</div>
                <div><Badge variant="outline">Prix d'achat</Badge> (défaut: 0)</div>
                <div><Badge variant="outline">Prix de vente</Badge> (défaut: 0)</div>
                <div><Badge variant="outline">Prix de gros</Badge> (défaut: 0)</div>
                <div><Badge variant="outline">Seuil d'alerte</Badge> (défaut: 5)</div>
                <div><Badge variant="outline">Seuil de gros</Badge> (défaut: 10)</div>
                <div><Badge variant="outline">Catégorie</Badge> (optionnel)</div>
                <div><Badge variant="outline">Unité</Badge> (défaut: Pièce)</div>
              </div>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="flex-1 min-h-0 overflow-y-auto space-y-4 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm">
                <span className="font-medium">{parsedProducts.length}</span> produits à importer
                {duplicates > 0 && (
                  <span className="text-muted-foreground ml-2">
                    ({duplicates} doublon(s) trouvé(s) et sera/seront ignoré(s))
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center border rounded-md p-1">
                  <Button
                    variant={filter === 'all' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setFilter('all')}
                    className="h-7 text-xs"
                  >
                    Tous ({parsedProducts.length})
                  </Button>
                  <Button
                    variant={filter === 'warnings' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setFilter('warnings')}
                    className="h-7 text-xs gap-1"
                  >
                    <AlertTriangle className="h-3 w-3" />
                    Avec avert. ({productsWithWarnings})
                  </Button>
                </div>
              </div>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>Produit</TableHead>
                        <TableHead>Quantité</TableHead>
                        <TableHead>Prix achat</TableHead>
                        <TableHead>Prix vente</TableHead>
                        <TableHead className="hidden sm:table-cell">Prix gros</TableHead>
                        <TableHead className="hidden sm:table-cell">Seuil alerte</TableHead>
                        <TableHead className="hidden sm:table-cell">Catégorie</TableHead>
                        <TableHead className="hidden sm:table-cell">Unité</TableHead>
                        <TableHead className="hidden sm:table-cell">Statut</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProducts.slice(0, 100).map((product) => {
                        const actualIndex = parsedProducts.indexOf(product);
                        return (
                          <TableRow key={actualIndex}>
                            <TableCell className="text-muted-foreground">{product.rowNumber}</TableCell>
                            <TableCell className="font-medium">{product.name}</TableCell>
                            <TableCell>{product.quantity}</TableCell>
                            <TableCell>{product.purchasePrice}</TableCell>
                            <TableCell>{product.retailPrice}</TableCell>
                            <TableCell className="hidden sm:table-cell">{product.wholesalePrice}</TableCell>
                            <TableCell className="hidden sm:table-cell">{product.alertThreshold}</TableCell>
                            <TableCell className="hidden sm:table-cell">{product.category || '-'}</TableCell>
                            <TableCell className="hidden sm:table-cell">{product.unit}</TableCell>
                            <TableCell className="hidden sm:table-cell">
                              {product.errors.length === 0 && product.warnings.length === 0 && (
                                <Badge variant="success" className="gap-1">
                                  <Check className="h-3 w-3" /> OK
                                </Badge>
                              )}
                              {product.warnings.length > 0 && (
                                <Badge variant="warning" className="gap-1">
                                  <AlertTriangle className="h-3 w-3" /> {product.warnings.length} avert.
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveProduct(actualIndex)}
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                {filteredProducts.length > 100 && (
                  <div className="p-2 text-center text-xs text-muted-foreground border-t">
                    Affichage limité à 100 lignes (sur {filteredProducts.length})
                  </div>
                )}
                {filteredProducts.length === 0 && (
                  <div className="p-4 sm:p-8 text-center text-sm text-muted-foreground">
                    Aucun produit à afficher avec ce filtre
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {step === 'importing' && (
          <div className="flex-1 flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-10 w-10 sm:h-12 sm:w-12 animate-spin text-primary" />
            <p className="text-sm font-medium">Import en cours...</p>
            <p className="text-xs text-muted-foreground">
              Veuillez patienter, cela peut prendre quelques instants
            </p>
          </div>
        )}

        {step === 'result' && (
          <div className="flex-1 min-h-0 overflow-y-auto space-y-4 py-4">
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              <Card className={importResult.success > 0 ? 'border-[oklch(0.65_0.12_145)]/40' : ''}>
                <CardContent className="pt-4 sm:pt-6 text-center">
                  <div className="text-2xl sm:text-3xl font-bold tabular-nums text-[oklch(0.42_0.11_145)]">{importResult.success}</div>
                  <div className="text-xs text-muted-foreground mt-1">Importé(s)</div>
                </CardContent>
              </Card>
              <Card className={importResult.skipped > 0 ? 'border-[oklch(0.75_0.15_75)]/40' : ''}>
                <CardContent className="pt-4 sm:pt-6 text-center">
                  <div className="text-2xl sm:text-3xl font-bold tabular-nums text-[oklch(0.52_0.13_75)]">{importResult.skipped}</div>
                  <div className="text-xs text-muted-foreground mt-1">Ignoré(s)</div>
                </CardContent>
              </Card>
              <Card className={importResult.errors > 0 ? 'border-destructive/40' : ''}>
                <CardContent className="pt-4 sm:pt-6 text-center">
                  <div className="text-2xl sm:text-3xl font-bold tabular-nums text-destructive">{importResult.errors}</div>
                  <div className="text-xs text-muted-foreground mt-1">Erreur(s)</div>
                </CardContent>
              </Card>
            </div>

            {importResult.errorDetails.length > 0 && (
              <Card>
                <CardHeader>
                  <p className="text-sm font-medium">Détails des erreurs</p>
                </CardHeader>
                <CardContent>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {importResult.errorDetails.map((error, index) => (
                      <div key={index} className="text-xs text-destructive wrap-break-word">
                        {error}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <div className="shrink-0 flex flex-col-reverse gap-2 pt-4 border-t sm:flex-row sm:justify-end">
          {step === 'upload' && (
            <>
              <Button variant="outline" onClick={handleClose} className="w-full sm:w-auto">
                Annuler
              </Button>
              <Button onClick={handlePreview} disabled={!file} className="w-full sm:w-auto">
                Suivant
              </Button>
            </>
          )}
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')} className="w-full sm:w-auto">
                Retour
              </Button>
              <Button onClick={handleImport} disabled={isImporting} className="w-full sm:w-auto">
                Importer {parsedProducts.length} produit(s)
              </Button>
            </>
          )}
          {step === 'result' && (
            <Button onClick={handleClose} className="w-full sm:w-auto">
              Fermer
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
