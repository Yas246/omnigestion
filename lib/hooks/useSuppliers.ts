'use client';

import { useState, useEffect } from 'react';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  orderBy,
} from 'firebase/firestore';
import { db, COLLECTIONS } from '@/lib/firebase';
import { useAuth } from './useAuth';
import type { Supplier } from '@/types';

export interface SupplierInput {
  name: string;
  code?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export function useSuppliers() {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.currentCompanyId) {
      fetchSuppliers();
    }
  }, [user]);

  const fetchSuppliers = async () => {
    if (!user?.currentCompanyId) return;

    try {
      setLoading(true);
      const q = query(
        collection(db, COLLECTIONS.companySuppliers(user.currentCompanyId)),
        orderBy('name', 'asc')
      );

      const snapshot = await getDocs(q);
      const suppliersData = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as Supplier;
      });

      setSuppliers(suppliersData);
    } catch (err) {
      console.error('Erreur lors du chargement des fournisseurs:', err);
      setError('Erreur lors du chargement des fournisseurs');
    } finally {
      setLoading(false);
    }
  };

  const createSupplier = async (data: SupplierInput) => {
    if (!user?.currentCompanyId) throw new Error('Utilisateur non connecté');

    try {
      // Générer un code automatique si non fourni
      let code = data.code;
      if (!code) {
        const count = suppliers.length;
        const codeNum = (count + 1).toString().padStart(4, '0');
        code = `FO-${codeNum}`;
      }

      const docRef = await addDoc(collection(db, COLLECTIONS.companySuppliers(user.currentCompanyId)), {
        ...data,
        code,
        companyId: user.currentCompanyId,
        totalPurchases: 0,
        totalAmount: 0,
        currentDebt: 0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await fetchSuppliers();
      return { success: true, id: docRef.id };
    } catch (err) {
      console.error('Erreur lors de la création du fournisseur:', err);
      throw new Error('Erreur lors de la création du fournisseur');
    }
  };

  const updateSupplier = async (id: string, data: Partial<SupplierInput>) => {
    if (!user?.currentCompanyId) throw new Error('Utilisateur non connecté');

    try {
      const docRef = doc(db, COLLECTIONS.companySuppliers(user.currentCompanyId), id);
      await updateDoc(docRef, {
        ...data,
        updatedAt: new Date(),
      });

      await fetchSuppliers();
      return { success: true };
    } catch (err) {
      console.error('Erreur lors de la mise à jour du fournisseur:', err);
      throw new Error('Erreur lors de la mise à jour du fournisseur');
    }
  };

  const deleteSupplier = async (id: string) => {
    if (!user?.currentCompanyId) throw new Error('Utilisateur non connecté');

    try {
      const docRef = doc(db, COLLECTIONS.companySuppliers(user.currentCompanyId), id);
      await deleteDoc(docRef);

      await fetchSuppliers();
      return { success: true };
    } catch (err) {
      console.error('Erreur lors de la suppression du fournisseur:', err);
      throw new Error('Erreur lors de la suppression du fournisseur');
    }
  };

  const getSupplierById = (id: string) => {
    return suppliers.find(s => s.id === id);
  };

  return {
    suppliers,
    loading,
    error,
    fetchSuppliers,
    createSupplier,
    updateSupplier,
    deleteSupplier,
    getSupplierById,
  };
}
