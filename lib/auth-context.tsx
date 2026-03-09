'use client';

// Contexte d'authentification pour Omnigestion
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  User,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, collection } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './firebase';
import type { User as AppUser, Company } from '@/types';

interface AuthContextType {
  user: (AppUser & { firebaseUser: User }) | null;
  companies: Company[];
  currentCompany: Company | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, companyName: string, firstName: string, lastName: string, position: string, phone: string, businessSector: 'commerce' | 'commerce_and_services') => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  switchCompany: (companyId: string) => Promise<void>;
  createCompany: (companyData: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<(AppUser & { firebaseUser: User }) | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setLoading(false);
      setError('Firebase n\'est pas configuré. Veuillez configurer les variables d\'environnement.');
      return;
    }

    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser: User | null) => {
        if (firebaseUser) {
          try {
            // Récupérer les données utilisateur depuis Firestore
            const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));

            if (userDoc.exists()) {
              const userData = userDoc.data() as Omit<AppUser, 'id'>;
              setUser({
                id: firebaseUser.uid,
                ...userData,
                firebaseUser,
              });

              // Charger les entreprises de l'utilisateur
              if (userData.companyIds && userData.companyIds.length > 0) {
                await loadCompanies(userData.companyIds, userData.currentCompanyId);
              }
            } else {
              // Utilisateur Firebase sans document Firestore
              setUser({
                id: firebaseUser.uid,
                email: firebaseUser.email || '',
                role: 'employee',
                companyIds: [],
                currentCompanyId: '',
                createdAt: new Date(),
                updatedAt: new Date(),
                firebaseUser,
              });
            }
          } catch (err) {
            console.error('Erreur lors de la récupération des données utilisateur:', err);
            setError('Erreur lors du chargement des données utilisateur');
          }
        } else {
          setUser(null);
          setCompanies([]);
          setCurrentCompany(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Erreur d\'authentification:', err);
        setError('Erreur d\'authentification');
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  // Charger les entreprises de l'utilisateur
  const loadCompanies = async (companyIds: string[], currentCompanyId: string) => {
    try {
      const companyPromises = companyIds.map(async (companyId) => {
        const companyDoc = await getDoc(doc(db, 'companies', companyId));
        if (companyDoc.exists()) {
          return {
            id: companyDoc.id,
            ...companyDoc.data(),
          } as Company;
        }
        return null;
      });

      const companiesData = await Promise.all(companyPromises);
      const validCompanies = companiesData.filter((c): c is Company => c !== null);
      setCompanies(validCompanies);

      // Définir l'entreprise actuelle
      const current = validCompanies.find(c => c.id === currentCompanyId);
      if (current) {
        setCurrentCompany(current);
      } else if (validCompanies.length > 0) {
        // Fallback : première entreprise si currentCompanyId invalide
        setCurrentCompany(validCompanies[0]);
      }
    } catch (err) {
      console.error('Erreur lors du chargement des entreprises:', err);
    }
  };

  const signIn = async (email: string, password: string) => {
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      console.error('Erreur de connexion:', err);
      const errorMessage = err.code === 'auth/invalid-credential'
        ? 'Email ou mot de passe incorrect'
        : err.code === 'auth/user-not-found'
        ? 'Utilisateur non trouvé'
        : err.code === 'auth/wrong-password'
        ? 'Mot de passe incorrect'
        : 'Erreur lors de la connexion';
      setError(errorMessage);
      throw err;
    }
  };

  const signUp = async (
    email: string,
    password: string,
    companyName: string,
    firstName: string,
    lastName: string,
    position: string,
    phone: string,
    businessSector: 'commerce' | 'commerce_and_services'
  ) => {
    setError(null);
    try {
      // Créer l'utilisateur Firebase
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      // Générer un ID unique pour l'entreprise
      const companyRef = doc(collection(db, 'companies'));
      const companyId = companyRef.id;

      // Créer l'entreprise
      await setDoc(companyRef, {
        name: companyName,
        businessSector: businessSector,
        currency: 'FCFA',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Créer le document utilisateur
      const userRef = doc(db, 'users', userCredential.user.uid);
      await setDoc(userRef, {
        email: email,
        displayName: `${firstName} ${lastName}`,
        firstName: firstName,
        lastName: lastName,
        position: position,
        phone: phone,
        role: 'admin',
        companyIds: [companyId],
        currentCompanyId: companyId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err: any) {
      console.error('Erreur d\'inscription:', err);
      const errorMessage = err.code === 'auth/email-already-in-use'
        ? 'Cette adresse email est déjà utilisée'
        : err.code === 'auth/weak-password'
        ? 'Le mot de passe doit contenir au moins 6 caractères'
        : err.code === 'auth/invalid-email'
        ? 'Adresse email invalide'
        : 'Erreur lors de l\'inscription';
      setError(errorMessage);
      throw err;
    }
  };

  const switchCompany = async (companyId: string) => {
    if (!user) return;

    try {
      const userRef = doc(db, 'users', user.id);
      await setDoc(userRef, {
        currentCompanyId: companyId,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      // Recharger les données utilisateur
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        const userData = userDoc.data() as Omit<AppUser, 'id'>;
        setUser({
          id: user.id,
          ...userData,
          firebaseUser: user.firebaseUser,
        });

        // Mettre à jour l'entreprise actuelle
        const company = companies.find(c => c.id === companyId);
        if (company) {
          setCurrentCompany(company);
        }
      }
    } catch (err) {
      console.error('Erreur lors du changement d\'entreprise:', err);
      setError('Erreur lors du changement d\'entreprise');
      throw err;
    }
  };

  const createCompany = async (companyData: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!user || user.role !== 'admin') {
      throw new Error('Seuls les administrateurs peuvent créer des entreprises');
    }

    try {
      // Créer la nouvelle entreprise
      const companyRef = doc(collection(db, 'companies'));
      const companyId = companyRef.id;

      await setDoc(companyRef, {
        ...companyData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Ajouter l'entreprise à la liste de l'utilisateur
      const userRef = doc(db, 'users', user.id);
      const updatedCompanyIds = [...user.companyIds, companyId];

      await setDoc(userRef, {
        companyIds: updatedCompanyIds,
        currentCompanyId: companyId, // Basculer vers la nouvelle entreprise
        updatedAt: serverTimestamp(),
      }, { merge: true });

      // Recharger les données utilisateur
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        const userData = userDoc.data() as Omit<AppUser, 'id'>;
        setUser({
          id: user.id,
          ...userData,
          firebaseUser: user.firebaseUser,
        });

        // Recharger les entreprises
        await loadCompanies(updatedCompanyIds, companyId);
      }
    } catch (err) {
      console.error('Erreur lors de la création de l\'entreprise:', err);
      setError('Erreur lors de la création de l\'entreprise');
      throw err;
    }
  };

  const signOutUser = async () => {
    setError(null);
    try {
      await firebaseSignOut(auth);
    } catch (err: any) {
      console.error('Erreur de déconnexion:', err);
      setError('Erreur lors de la déconnexion');
      throw err;
    }
  };

  const refreshUser = async () => {
    if (!user) return;

    try {
      // Recharger les données utilisateur depuis Firestore
      const userDoc = await getDoc(doc(db, 'users', user.id));
      if (userDoc.exists()) {
        const userData = userDoc.data() as Omit<AppUser, 'id'>;
        setUser({
          id: user.id,
          ...userData,
          firebaseUser: user.firebaseUser,
        });
      }
    } catch (err) {
      console.error('Erreur lors du rafraîchissement des données utilisateur:', err);
      setError('Erreur lors du rafraîchissement des données utilisateur');
      throw err;
    }
  };

  const resetPassword = async (email: string) => {
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (err: any) {
      console.error('Erreur de réinitialisation:', err);
      const errorMessage = err.code === 'auth/user-not-found'
        ? 'Aucun compte trouvé avec cette adresse email'
        : err.code === 'auth/invalid-email'
        ? 'Adresse email invalide'
        : 'Erreur lors de la réinitialisation du mot de passe';
      setError(errorMessage);
      throw err;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        companies,
        currentCompany,
        loading,
        error,
        signIn,
        signUp,
        signOut: signOutUser,
        resetPassword,
        switchCompany,
        createCompany,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth doit être utilisé à l\'intérieur d\'un AuthProvider');
  }
  return context;
}
