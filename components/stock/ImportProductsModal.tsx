'use client';

import { useState } from 'react';
import { doc, collection, getDocs, query, where, writeBatch, Timestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FileSpreadsheet, Check, X, AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { db, COLLECTIONS, SUB_COLLECTIONS } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import { useSettings } from '@/lib/hooks/useSettings';
import { parseProductFile, type ParsedProduct } from '@/lib/utils/excelParser';
import type { Product } from '@/types';

interface ImportProductsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

export function ImportProductsModal({ open, onOpenChange, onImportComplete }: ImportProductsModalProps) {
  const { user } = useAuth();
  const { settings } = useSettings();
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
    if (!user?.currentCompanyId) return 0;

    const productNames = products.map(p => p.name.toLowerCase());

    const q = query(
      collection(db, COLLECTIONS.companyProducts(user.currentCompanyId)),
      where('companyId', '==', user.currentCompanyId)
    );
    const snapshot = await getDocs(q);

    // Compter les doublons
    let duplicateCount = 0;
    snapshot.forEach((doc) => {
      const product = doc.data() as Product;
      if (productNames.includes(product.name.toLowerCase())) {
        duplicateCount++;
      }
    });

    return duplicateCount;
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
      const q = query(
        collection(db, COLLECTIONS.companyProducts(user.currentCompanyId)),
        where('companyId', '==', user.currentCompanyId)
      );
      const snapshot = await getDocs(q);
      const existingProductNames = new Set(
        snapshot.docs.map(doc => (doc.data() as Product).name.toLowerCase())
      );

      // Utiliser un batch pour l'import
      const batch = writeBatch(db);
      const batchSize = 500; // Firestore batch limit
      let currentBatch = 0;

      for (const parsedProduct of parsedProducts) {
        // Vérifier si le produit existe déjà
        if (existingProductNames.has(parsedProduct.name.toLowerCase())) {
          skippedCount++;
          continue;
        }

        try {
          const productId = doc(collection(db, COLLECTIONS.companyProducts(user.currentCompanyId))).id;
          const productRef = doc(db, COLLECTIONS.companyProducts(user.currentCompanyId), productId);

          // Récupérer le dépôt par défaut depuis les settings
          const defaultWarehouseId = settings?.stock?.defaultWarehouseId;

          const productData: Omit<Product, 'id'> = {
            companyId: user.currentCompanyId,
            name: parsedProduct.name,
            code: `PROD-${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
            warehouseId: defaultWarehouseId,
            purchasePrice: Number(parsedProduct.purchasePrice) || 0,
            retailPrice: Number(parsedProduct.retailPrice) || 0,
            wholesalePrice: Number(parsedProduct.wholesalePrice) || 0,
            wholesaleThreshold: Number(parsedProduct.wholesaleThreshold) || 10,
            currentStock: Number(parsedProduct.quantity) || 0,
            alertThreshold: Number(parsedProduct.alertThreshold) || 5,
            ...(parsedProduct.category && { category: parsedProduct.category }),
            status: parsedProduct.quantity <= (Number(parsedProduct.alertThreshold) || 5) ? 'low' : parsedProduct.quantity === 0 ? 'out' : 'ok',
            unit: parsedProduct.unit || 'Pièce',
            isActive: true,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          };

          batch.set(productRef, productData);

          // Créer la répartition de stock dans le dépôt par défaut
          if (defaultWarehouseId) {
            const stockLocationRef = doc(
              collection(db, SUB_COLLECTIONS.productStockLocations(user.currentCompanyId, productId))
            );
            batch.set(stockLocationRef, {
              productId,
              warehouseId: defaultWarehouseId,
              quantity: Number(parsedProduct.quantity) || 0,
              alertThreshold: Number(parsedProduct.alertThreshold) || 5,
              updatedAt: Timestamp.now(),
            });
          }

          currentBatch++;

          // Si le batch est plein, l'exécuter et en créer un nouveau
          if (currentBatch >= batchSize) {
            await batch.commit();
            currentBatch = 0;
          }

          successCount++;
        } catch (error: any) {
          errorCount++;
          errorDetails.push(`Ligne ${parsedProduct.rowNumber}: ${error.message}`);
        }
      }

      // Exécuter le dernier batch s'il reste des opérations
      if (currentBatch > 0) {
        console.log('[ImportProductsModal] Commit du batch avec', currentBatch, 'opérations');
        try {
          await batch.commit();
          console.log('[ImportProductsModal] Batch commit réussi');
        } catch (commitError) {
          console.error('[ImportProductsModal] Erreur lors du commit du batch:', commitError);
          throw commitError;
        }
      } else {
        console.warn('[ImportProductsModal] Aucune opération à committer (currentBatch = 0)');
      }

      setImportResult({
        success: successCount,
        errors: errorCount,
        skipped: skippedCount,
        errorDetails,
      });

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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importer des produits</DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Importez vos produits depuis un fichier Excel ou CSV'}
            {step === 'preview' && 'Vérifiez les données avant l\'import'}
            {step === 'importing' && 'Import en cours...'}
            {step === 'result' && 'Résultat de l\'import'}
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4 py-4">
            <div
              className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 space-y-4 transition-colors ${
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
                <CardContent className="py-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium">{file.name}</span>
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
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between">
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
                <div className="max-h-96 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>Produit</TableHead>
                        <TableHead>Quantité</TableHead>
                        <TableHead>Prix achat</TableHead>
                        <TableHead>Prix vente</TableHead>
                        <TableHead>Prix gros</TableHead>
                        <TableHead>Seuil alerte</TableHead>
                        <TableHead>Catégorie</TableHead>
                        <TableHead>Unité</TableHead>
                        <TableHead>Statut</TableHead>
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
                            <TableCell>{product.wholesalePrice}</TableCell>
                            <TableCell>{product.alertThreshold}</TableCell>
                            <TableCell>{product.category || '-'}</TableCell>
                            <TableCell>{product.unit}</TableCell>
                            <TableCell>
                              {product.errors.length === 0 && product.warnings.length === 0 && (
                                <Badge variant="default" className="gap-1">
                                  <Check className="h-3 w-3" /> OK
                                </Badge>
                              )}
                              {product.warnings.length > 0 && (
                                <Badge variant="secondary" className="gap-1">
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
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    Aucun produit à afficher avec ce filtre
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {step === 'importing' && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-sm font-medium">Import en cours...</p>
            <p className="text-xs text-muted-foreground">
              Veuillez patienter, cela peut prendre quelques instants
            </p>
          </div>
        )}

        {step === 'result' && (
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-3 gap-4">
              <Card className={importResult.success > 0 ? 'border-green-500' : ''}>
                <CardContent className="pt-6 text-center">
                  <div className="text-3xl font-bold text-green-600">{importResult.success}</div>
                  <div className="text-xs text-muted-foreground mt-1">Importé(s)</div>
                </CardContent>
              </Card>
              <Card className={importResult.skipped > 0 ? 'border-yellow-500' : ''}>
                <CardContent className="pt-6 text-center">
                  <div className="text-3xl font-bold text-yellow-600">{importResult.skipped}</div>
                  <div className="text-xs text-muted-foreground mt-1">Ignoré(s)</div>
                </CardContent>
              </Card>
              <Card className={importResult.errors > 0 ? 'border-red-500' : ''}>
                <CardContent className="pt-6 text-center">
                  <div className="text-3xl font-bold text-red-600">{importResult.errors}</div>
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
                  <div className="max-h-40 overflow-auto space-y-1">
                    {importResult.errorDetails.map((error, index) => (
                      <div key={index} className="text-xs text-destructive">
                        {error}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t">
          {step === 'upload' && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Annuler
              </Button>
              <Button onClick={handlePreview} disabled={!file}>
                Suivant
              </Button>
            </>
          )}
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>
                Retour
              </Button>
              <Button onClick={handleImport} disabled={isImporting}>
                Importer {parsedProducts.length} produit(s)
              </Button>
            </>
          )}
          {step === 'result' && (
            <Button onClick={handleClose}>
              Fermer
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
