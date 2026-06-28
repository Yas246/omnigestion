import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { db, COLLECTIONS } from '@/lib/firebase';

const mainCashRegisterCache = new Map<string, string | null>();

export async function getMainCashRegisterId(companyId: string): Promise<string | null> {
  const cached = mainCashRegisterCache.get(companyId);
  if (cached !== undefined) {
    return cached;
  }

  const cashRegistersRef = collection(db, COLLECTIONS.companyCashRegisters(companyId));
  const mainSnap = await getDocs(query(cashRegistersRef, where('isMain', '==', true)));

  let result: string | null = null;
  if (!mainSnap.empty) {
    result = mainSnap.docs[0].id;
  } else {
    const fallbackSnap = await getDocs(query(cashRegistersRef, limit(1)));
    if (!fallbackSnap.empty) {
      result = fallbackSnap.docs[0].id;
    }
  }

  mainCashRegisterCache.set(companyId, result);
  return result;
}

export function invalidateMainCashRegisterCache(companyId?: string) {
  if (companyId) {
    mainCashRegisterCache.delete(companyId);
  } else {
    mainCashRegisterCache.clear();
  }
}
