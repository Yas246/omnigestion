import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Types pour les paramètres de la compagnie
 */
export interface CompanySettings {
  // Informations générales
  companyName: string;
  companyEmail: string;
  companyPhone: string;
  companyAddress: string;
  companyCity: string;
  companyCountry: string;
  taxId: string;

  // Paramètres de facturation
  invoicePrefix: string;
  invoiceNumberDigits: number;
  nextInvoiceNumber: number;
  defaultPaymentTerms: number; // en jours
  defaultTaxRate: number; // en pourcentage

  // Paramètres de stock
  primaryWarehouseId: string;
  lowStockAlertEnabled: boolean;
  autoStockTransferEnabled: boolean;

  // Paramètres de devise
  currency: string; // 'USD', 'EUR', 'XOF', etc.
  currencySymbol: string;
  currencyPosition: "before" | "after";

  // Paramètres d'affichage
  dateFormat: string; // 'DD/MM/YYYY', 'MM/DD/YYYY', etc.
  timezone: string;

  // Paramètres de notifications
  emailNotificationsEnabled: boolean;
  pushNotificationsEnabled: boolean;
  lowStockNotificationsEnabled: boolean;
  newSaleNotificationsEnabled: boolean;
}

/**
 * État du store paramètres
 */
interface SettingsState {
  // Données
  settings: CompanySettings | null;

  // État de chargement
  loading: boolean;
  error: string | null;
  lastLoadedAt: number | null;

  // Actions
  setSettings: (settings: CompanySettings) => void;
  updateSettings: (updates: Partial<CompanySettings>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearSettings: () => void;

  // Getters
  getInvoiceNumber: () => string;
  formatCurrency: (amount: number) => string;
  formatDate: (date: Date) => string;
}

/**
 * Valeurs par défaut pour les paramètres
 */
const defaultSettings: CompanySettings = {
  companyName: "",
  companyEmail: "",
  companyPhone: "",
  companyAddress: "",
  companyCity: "",
  companyCountry: "",
  taxId: "",
  invoicePrefix: "INV",
  invoiceNumberDigits: 4,
  nextInvoiceNumber: 1,
  defaultPaymentTerms: 30,
  defaultTaxRate: 19, // TVA par défaut (19% au Cameroun)
  primaryWarehouseId: "",
  lowStockAlertEnabled: true,
  autoStockTransferEnabled: true,
  currency: "XOF",
  currencySymbol: "FCFA",
  currencyPosition: "after",
  dateFormat: "DD/MM/YYYY",
  timezone: "Africa/Douala",
  emailNotificationsEnabled: true,
  pushNotificationsEnabled: true,
  lowStockNotificationsEnabled: true,
  newSaleNotificationsEnabled: true,
};

/**
 * Store paramètres avec persistance localStorage
 *
 * Les paramètres changent rarement, donc on peut les mettre en cache localement
 */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      // État initial
      settings: null,
      loading: false,
      error: null,
      lastLoadedAt: null,

      /**
       * Définir les paramètres
       */
      setSettings: (settings) => {
        console.log("[setSettings] Mise à jour paramètres");
        set({
          settings,
          lastLoadedAt: Date.now(),
        });
      },

      /**
       * Mettre à jour certains paramètres
       */
      updateSettings: (updates) => {
        const { settings } = get();

        if (!settings) {
          console.error("[updateSettings] Aucun paramètre défini");
          return;
        }

        console.log("[updateSettings] Mise à jour partielle", { updates });
        set({
          settings: {
            ...settings,
            ...updates,
          },
        });
      },

      /**
       * Définir l'état de chargement
       */
      setLoading: (loading) => {
        set({ loading });
      },

      /**
       * Définir une erreur
       */
      setError: (error) => {
        set({ error });
      },

      /**
       * Vider tous les paramètres
       */
      clearSettings: () => {
        console.log("[clearSettings] Vidage du store");
        set({
          settings: null,
          lastLoadedAt: null,
        });
      },

      /**
       * Générer un numéro de facture
       */
      getInvoiceNumber: () => {
        const { settings } = get();

        if (!settings) {
          console.error("[getInvoiceNumber] Aucun paramètre défini");
          return "INV-0001";
        }

        const number = String(settings.nextInvoiceNumber).padStart(
          settings.invoiceNumberDigits,
          "0",
        );
        return `${settings.invoicePrefix}-${number}`;
      },

      /**
       * Formater un montant en devise
       */
      formatCurrency: (amount) => {
        const { settings } = get();

        if (!settings) {
          return `${amount.toFixed(2)} FCFA`;
        }

        const formattedAmount = amount.toLocaleString("fr-FR", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        });

        if (settings.currencyPosition === "before") {
          return `${settings.currencySymbol} ${formattedAmount}`;
        } else {
          return `${formattedAmount} ${settings.currencySymbol}`;
        }
      },

      /**
       * Formater une date
       */
      formatDate: (date) => {
        const { settings } = get();

        if (!settings) {
          return date.toLocaleDateString("fr-FR");
        }

        // Format simple pour l'instant
        // TODO: Utiliser une librairie comme date-fns ou dayjs
        return date.toLocaleDateString("fr-FR");
      },
    }),
    {
      name: "settings-storage", // Clé localStorage
      // Persister seulement les données, pas l'état de chargement
      partialize: (state) => ({
        settings: state.settings,
        lastLoadedAt: state.lastLoadedAt,
      }),
    },
  ),
);

/**
 * Sélecteurs dérivés
 */
export const selectSettings = () => useSettingsStore.getState().settings;
export const selectPrimaryWarehouseId = () =>
  useSettingsStore.getState().settings?.primaryWarehouseId || "";

/**
 * Hooks pour utiliser le store
 */
export const useSettings = () => useSettingsStore((state) => state.settings);
export const useSettingsLoading = () =>
  useSettingsStore((state) => state.loading);
export const useSettingsActions = () =>
  useSettingsStore((state) => ({
    setSettings: state.setSettings,
    updateSettings: state.updateSettings,
    clearSettings: state.clearSettings,
    getInvoiceNumber: state.getInvoiceNumber,
    formatCurrency: state.formatCurrency,
    formatDate: state.formatDate,
  }));

/**
 * Hooks utilitaires
 */
export const useFormatCurrency = () =>
  useSettingsStore((state) => state.formatCurrency);
export const useFormatDate = () =>
  useSettingsStore((state) => state.formatDate);
export const usePrimaryWarehouseId = () =>
  useSettingsStore((state) => state.settings?.primaryWarehouseId || "");

export default useSettingsStore;
