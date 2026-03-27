'use client';

import { useState, useEffect } from 'react';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  query,
  where,
} from 'firebase/firestore';
import { db, COLLECTIONS, auth } from '@/lib/firebase';
import { useAuth } from './useAuth';
import type { Company, Settings, Warehouse, InvoiceSettings, StockSettings, BackupSettings, SystemSettings } from '@/types';

export function useSettings() {
  const { user } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.currentCompanyId) {
      fetchCompanyData();
    }
  }, [user]);

  const fetchCompanyData = async () => {
    if (!user?.currentCompanyId) return;

    setLoading(true);
    setError(null);

    try {
      // Récupérer l'entreprise
      const companyDoc = await getDoc(doc(db, 'companies', user.currentCompanyId));
      if (companyDoc.exists()) {
        setCompany({ id: companyDoc.id, ...companyDoc.data() } as Company);
      }

      // Récupérer les paramètres
      const settingsDoc = await getDoc(doc(db, COLLECTIONS.companySettings(user.currentCompanyId), 'config'));
      if (settingsDoc.exists()) {
        setSettings(settingsDoc.data() as Settings);
      }

      // Récupérer les dépôts
      const warehousesQuery = query(
        collection(db, COLLECTIONS.companyWarehouses(user.currentCompanyId))
      );
      const warehousesSnapshot = await getDocs(warehousesQuery);
      const warehousesData = warehousesSnapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Warehouse)
      );
      setWarehouses(warehousesData);
    } catch (err) {
      console.error('Erreur lors du chargement des données:', err);
      setError('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  // ==================== ENTREPRISE ====================

  const updateCompany = async (data: Partial<Company>) => {
    if (!user?.currentCompanyId) throw new Error('Utilisateur non connecté');

    try {
      const companyRef = doc(db, 'companies', user.currentCompanyId);
      await updateDoc(companyRef, {
        ...data,
        updatedAt: new Date(),
      });

      setCompany((prev) => (prev ? { ...prev, ...data } : null));

      // Log audit
      await logAudit('update', 'company', user.currentCompanyId, 'Mise à jour des informations entreprise');
    } catch (err) {
      console.error('Erreur lors de la mise à jour de l\'entreprise:', err);
      throw new Error('Erreur lors de la mise à jour de l\'entreprise');
    }
  };

  const uploadLogo = async (file: File): Promise<string> => {
    if (!user?.currentCompanyId) throw new Error('Utilisateur non connecté');

    try {
      // Créer FormData pour l'upload
      const formData = new FormData();
      formData.append('file', file);

      // Upload via l'API Cloudinary
      // Récupérer le token d'authentification
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
      if (!token) {
        throw new Error('Non authentifié');
      }

      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors de l\'upload');
      }

      const { url } = await response.json();

      // Mettre à jour l'entreprise avec la nouvelle URL du logo
      await updateCompany({ logoUrl: url });

      return url;
    } catch (err) {
      console.error('Erreur lors de l\'upload du logo:', err);
      throw new Error('Erreur lors de l\'upload du logo');
    }
  };

  // ==================== PARAMÈTRES ====================

  const updateInvoiceSettings = async (data: Partial<InvoiceSettings>) => {
    if (!user?.currentCompanyId) throw new Error('Utilisateur non connecté');

    try {
      const settingsRef = doc(db, COLLECTIONS.companySettings(user.currentCompanyId), 'config');
      await setDoc(
        settingsRef,
        {
          invoice: { ...settings?.invoice, ...data },
          updatedAt: new Date(),
        },
        { merge: true }
      );

      setSettings((prev) =>
        prev ? { ...prev, invoice: { ...prev.invoice, ...data } as InvoiceSettings } : null
      );

      await logAudit('update', 'settings', user.currentCompanyId, 'Mise à jour des paramètres de facturation');
    } catch (err) {
      console.error('Erreur lors de la mise à jour des paramètres de facturation:', err);
      throw new Error('Erreur lors de la mise à jour des paramètres');
    }
  };

  const updateStockSettings = async (data: Partial<StockSettings>) => {
    if (!user?.currentCompanyId) throw new Error('Utilisateur non connecté');

    try {
      const settingsRef = doc(db, COLLECTIONS.companySettings(user.currentCompanyId), 'config');
      await setDoc(
        settingsRef,
        {
          stock: { ...settings?.stock, ...data },
          updatedAt: new Date(),
        },
        { merge: true }
      );

      setSettings((prev) =>
        prev ? { ...prev, stock: { ...prev.stock, ...data } as StockSettings } : null
      );

      await logAudit('update', 'settings', user.currentCompanyId, 'Mise à jour des paramètres de stock');
    } catch (err) {
      console.error('Erreur lors de la mise à jour des paramètres de stock:', err);
      throw new Error('Erreur lors de la mise à jour des paramètres');
    }
  };

  const updateSystemSettings = async (data: Partial<SystemSettings>) => {
    if (!user?.currentCompanyId) throw new Error('Utilisateur non connecté');

    try {
      const settingsRef = doc(db, COLLECTIONS.companySettings(user.currentCompanyId), 'config');
      await setDoc(
        settingsRef,
        {
          system: { ...settings?.system, ...data },
          updatedAt: new Date(),
        },
        { merge: true }
      );

      setSettings((prev) =>
        prev ? { ...prev, system: { ...prev.system, ...data } as SystemSettings } : null
      );

      await logAudit('update', 'settings', user.currentCompanyId, 'Mise à jour des paramètres système');
    } catch (err) {
      console.error('Erreur lors de la mise à jour des paramètres système:', err);
      throw new Error('Erreur lors de la mise à jour des paramètres');
    }
  };

  // ==================== DÉPÔTS ====================

  const createWarehouse = async (data: Omit<Warehouse, 'id' | 'companyId' | 'createdAt' | 'updatedAt'>) => {
    if (!user?.currentCompanyId) throw new Error('Utilisateur non connecté');

    try {
      // Si c'est le dépôt principal, désactiver les autres
      if (data.isMain) {
        for (const warehouse of warehouses) {
          if (warehouse.isMain) {
            await updateDoc(doc(db, COLLECTIONS.companyWarehouses(user.currentCompanyId), warehouse.id), {
              isMain: false,
            });
          }
        }
      }

      const docRef = await addDoc(collection(db, COLLECTIONS.companyWarehouses(user.currentCompanyId)), {
        ...data,
        companyId: user.currentCompanyId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const newWarehouse: Warehouse = {
        id: docRef.id,
        ...data,
        companyId: user.currentCompanyId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      setWarehouses((prev) => [...prev, newWarehouse]);

      await logAudit('create', 'warehouse', docRef.id, 'Création d\'un dépôt');

      return newWarehouse;
    } catch (err) {
      console.error('Erreur lors de la création du dépôt:', err);
      throw new Error('Erreur lors de la création du dépôt');
    }
  };

  const updateWarehouse = async (id: string, data: Partial<Warehouse>) => {
    if (!user?.currentCompanyId) throw new Error('Utilisateur non connecté');

    try {
      // Si c'est le dépôt principal, désactiver les autres
      if (data.isMain) {
        for (const warehouse of warehouses) {
          if (warehouse.isMain && warehouse.id !== id) {
            await updateDoc(doc(db, COLLECTIONS.companyWarehouses(user.currentCompanyId), warehouse.id), {
              isMain: false,
            });
          }
        }
      }

      const warehouseRef = doc(db, COLLECTIONS.companyWarehouses(user.currentCompanyId), id);
      await updateDoc(warehouseRef, {
        ...data,
        updatedAt: new Date(),
      });

      setWarehouses((prev) =>
        prev.map((w) => (w.id === id ? { ...w, ...data, updatedAt: new Date() } : w))
      );

      await logAudit('update', 'warehouse', id, 'Mise à jour d\'un dépôt');
    } catch (err) {
      console.error('Erreur lors de la mise à jour du dépôt:', err);
      throw new Error('Erreur lors de la mise à jour du dépôt');
    }
  };

  const deleteWarehouse = async (id: string) => {
    if (!user?.currentCompanyId) throw new Error('Utilisateur non connecté');

    try {
      await deleteDoc(doc(db, COLLECTIONS.companyWarehouses(user.currentCompanyId), id));

      setWarehouses((prev) => prev.filter((w) => w.id !== id));

      await logAudit('delete', 'warehouse', id, 'Suppression d\'un dépôt');
    } catch (err) {
      console.error('Erreur lors de la suppression du dépôt:', err);
      throw new Error('Erreur lors de la suppression du dépôt');
    }
  };

  // ==================== AUDIT ====================

  const logAudit = async (action: string, entityType: string, entityId?: string, description?: string) => {
    if (!user?.currentCompanyId) return;

    try {
      await addDoc(collection(db, COLLECTIONS.companyAuditLog(user.currentCompanyId)), {
        action,
        entityType,
        entityId,
        description,
        userId: user.id,
        userName: user.displayName || user.email,
        companyId: user.currentCompanyId,
        createdAt: new Date(),
      });
    } catch (err) {
      console.error('Erreur lors de l\'enregistrement audit:', err);
    }
  };

  // ==================== SAUVEGARDE ====================

  const createBackup = async () => {
    if (!user?.currentCompanyId) throw new Error('Utilisateur non connecté');

    // Cette fonction sera implémentée plus tard avec l'export de toutes les données
    throw new Error('Fonctionnalité non encore implémentée');
  };

  return {
    company,
    settings,
    warehouses,
    loading,
    error,
    updateCompany,
    uploadLogo,
    updateInvoiceSettings,
    updateStockSettings,
    updateSystemSettings,
    createWarehouse,
    updateWarehouse,
    deleteWarehouse,
    createBackup,
    refresh: fetchCompanyData,
  };
}
