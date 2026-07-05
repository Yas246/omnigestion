'use client';

/**
 * Settings — API-backed. Fetches company_settings from /settings, provides
 * update mutations for each section + company + warehouses.
 *  - useSettings()          -> { company, settings, warehouses, isLoading, updateCompany, updateInvoiceSettings, updateStockSettings, updateSystemSettings, createWarehouse, updateWarehouse, deleteWarehouse, uploadLogo, createBackup }
 *  - useSettingsRealtime()  -> { settings, isLoading, error } (settings page)
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useAuth } from '@/lib/auth-context';
import { useWarehousesRealtime, useWarehouses } from '@/lib/api/hooks/useWarehouses';
import type { Settings } from '@/types';

interface SettingsResponse {
  companyId: number;
  invoice: Record<string, any>;
  stock: Record<string, any>;
  backup: Record<string, any>;
  system: Record<string, any>;
  updatedAt: string;
}

function mapSettings(s: SettingsResponse | undefined, companyId: string): Settings {
  const invoice = s?.invoice ?? {};
  const stock = s?.stock ?? {};
  const backup = s?.backup ?? {};
  const system = s?.system ?? {};
  return {
    companyId,
    invoice: {
      prefix: invoice.prefix ?? 'FAC',
      nextNumber: invoice.nextNumber ?? 1,
      showTax: invoice.showTax ?? true,
      showUnitPrice: invoice.showUnitPrice ?? true,
      defaultTaxRate: invoice.defaultTaxRate ?? 0,
      defaultTerms: invoice.defaultTerms,
      template: invoice.template ?? 'standard',
    },
    stock: {
      defaultAlertThreshold: stock.defaultAlertThreshold ?? 5,
      defaultWarehouseId: stock.defaultWarehouseId,
    },
    backup: {
      autoBackupEnabled: backup.autoBackupEnabled ?? false,
      lastBackupDate: backup.lastBackupDate,
    },
    system: {
      theme: system.theme ?? 'system',
      language: system.language ?? 'fr',
    },
    updatedAt: s?.updatedAt ? new Date(s.updatedAt) : new Date(),
  };
}

export function useSettings() {
  const qc = useQueryClient();
  const { currentCompany } = useAuth();
  const companyId = currentCompany?.id ?? '';

  const settingsQuery = useQuery({
    queryKey: ['settings'] as const,
    queryFn: async () => {
      const res = await api.get<SettingsResponse>('/settings');
      return res;
    },
  });

  const { warehouses } = useWarehousesRealtime();
  const warehousesCrud = useWarehouses();

  const updateCompanyMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!currentCompany) throw new Error('No company selected');
      return api.patch(`/companies/${currentCompany.id}`, data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: any) => api.put('/settings', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  });

  const settings = mapSettings(settingsQuery.data, companyId);

  return {
    company: currentCompany,
    settings,
    warehouses,
    isLoading: settingsQuery.isLoading,
    updateCompany: (data: any) => updateCompanyMutation.mutateAsync(data),
    updateInvoiceSettings: (data: any) => updateSettingsMutation.mutateAsync({ invoice: data }),
    updateStockSettings: (data: any) => updateSettingsMutation.mutateAsync({ stock: data }),
    updateSystemSettings: (data: any) => updateSettingsMutation.mutateAsync({ system: data }),
    createWarehouse: warehousesCrud.createWarehouse,
    updateWarehouse: warehousesCrud.updateWarehouse,
    deleteWarehouse: warehousesCrud.deleteWarehouse,
    uploadLogo: async (_file: File) => {
      throw new Error('Logo upload not yet implemented on the new API.');
    },
    createBackup: async () => {
      throw new Error('Backup not yet implemented on the new API.');
    },
  };
}

export function useSettingsRealtime() {
  const { settings, isLoading } = useSettings();
  return { settings, isLoading, error: null as string | null };
}
