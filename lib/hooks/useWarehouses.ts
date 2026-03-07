'use client';

import { useState, useEffect } from 'react';
import {
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db, COLLECTIONS } from '@/lib/firebase';
import { useAuth } from './useAuth';
import type { Warehouse } from '@/types';

export function useWarehouses() {
  const { user } = useAuth();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.currentCompanyId) {
      fetchWarehouses();
    }
  }, [user]);

  const fetchWarehouses = async () => {
    if (!user?.currentCompanyId) return;

    try {
      setLoading(true);
      const q = query(
        collection(db, COLLECTIONS.companyWarehouses(user.currentCompanyId)),
        where('isActive', '==', true)
      );

      const snapshot = await getDocs(q);
      const warehousesData = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as Warehouse;
      });

      setWarehouses(warehousesData);
    } catch (err) {
      console.error('Erreur lors du chargement des dépôts:', err);
    } finally {
      setLoading(false);
    }
  };

  return {
    warehouses,
    loading,
  };
}
