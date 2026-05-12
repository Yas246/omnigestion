import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { db, COLLECTIONS } from '@/lib/firebase';

export async function getMainCashRegisterId(companyId: string): Promise<string | null> {
  const cashRegistersRef = collection(db, COLLECTIONS.companyCashRegisters(companyId));
  const mainSnap = await getDocs(query(cashRegistersRef, where('isMain', '==', true)));

  if (!mainSnap.empty) {
    return mainSnap.docs[0].id;
  }

  const fallbackSnap = await getDocs(query(cashRegistersRef, limit(1)));
  if (!fallbackSnap.empty) {
    return fallbackSnap.docs[0].id;
  }

  return null;
}
