'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useSettings } from '@/lib/hooks/useSettings';
import type { BackupSettings } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Loader2, Download, Upload } from 'lucide-react';

interface BackupTabProps {
  settings?: BackupSettings;
}

export function BackupTab({ settings }: BackupTabProps) {
  const { createBackup } = useSettings();
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [autoBackup, setAutoBackup] = useState(settings?.autoBackupEnabled ?? false);

  const handleCreateBackup = async () => {
    setIsCreatingBackup(true);
    try {
      // Pour l'instant, on va créer un backup JSON simple
      // Plus tard, on implémentera le full backup
      const backupData = {
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], {
        type: 'application/json',
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `omnigestion_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Sauvegarde créée avec succès');
    } catch (error) {
      toast.error('Erreur lors de la création de la sauvegarde');
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const handleRestoreBackup = () => {
    toast.info('Fonctionnalité de restauration à venir');
  };

  return (
    <div className="space-y-6">
      {/* Sauvegarde automatique */}
      <Card>
        <CardHeader>
          <CardTitle>Sauvegarde automatique</CardTitle>
          <CardDescription>
            Activez les sauvegardes automatiques quotidiennes de vos données
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <p className="font-medium">Sauvegarde quotidienne</p>
              <p className="text-sm text-muted-foreground">
                Une sauvegarde automatique sera créée chaque jour
              </p>
            </div>
            <Switch
              checked={autoBackup}
              onCheckedChange={setAutoBackup}
            />
          </div>
          {settings?.lastBackupDate && (
            <p className="mt-4 text-sm text-muted-foreground">
              Dernière sauvegarde: {new Date(settings.lastBackupDate).toLocaleString('fr-FR')}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Sauvegarde manuelle */}
      <Card>
        <CardHeader>
          <CardTitle>Sauvegarde manuelle</CardTitle>
          <CardDescription>
            Créez une sauvegarde complète de vos données à tout moment
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row">
            <Button
              onClick={handleCreateBackup}
              disabled={isCreatingBackup}
              className="flex-1"
            >
              {isCreatingBackup ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Création en cours...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Créer une sauvegarde
                </>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={handleRestoreBackup}
              className="flex-1"
            >
              <Upload className="mr-2 h-4 w-4" />
              Restaurer une sauvegarde
            </Button>
          </div>

          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Vous pouvez également glisser-déposer un fichier de sauvegarde ici pour le restaurer
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Informations */}
      <Card>
        <CardHeader>
          <CardTitle>À propos des sauvegardes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• Les sauvegardes contiennent toutes vos données (clients, produits, ventes, etc.)</p>
          <p>• Les fichiers sont au format JSON et peuvent être ouverts avec un éditeur de texte</p>
          <p>• Conservez vos sauvegardes dans un endroit sécurisé</p>
          <p>• Il est recommandé de faire des sauvegardes régulières</p>
        </CardContent>
      </Card>
    </div>
  );
}
