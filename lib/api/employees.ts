'use client';

/**
 * Employees (owner-invited team members) — API-backed.
 *  - useEmployees() -> { employees, isLoading, createEmployee, updateEmployee, deleteEmployee }
 * The /employees resource is the company_membership (id = membership id); an
 * employee's permissions are granular per module/action.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { Permission } from '@/types';

export interface ApiEmployee {
  id: number; // membership id (used for update/delete)
  userId: number;
  companyId: number;
  email: string | null;
  fullName: string | null;
  position: string | null;
  phone: string | null;
  isOwner: boolean;
  permissions: Permission[];
}

export interface CreateEmployeeInput {
  fullName: string;
  email: string;
  password: string;
  position?: string;
  phone?: string;
  permissions?: Permission[];
}

export interface UpdateEmployeeInput {
  fullName?: string;
  password?: string;
  position?: string;
  phone?: string;
  permissions?: Permission[];
}

const KEY = ['employees'] as const;

export function useEmployees() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: KEY });

  const listQuery = useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<ApiEmployee[]> => {
      const res = await api.get<ApiEmployee[] | { data: ApiEmployee[] }>('/employees');
      return Array.isArray(res) ? res : (res.data ?? []);
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateEmployeeInput) => api.post('/employees', data),
    onSuccess: invalidate,
  });
  const updateMutation = useMutation({
    mutationFn: async (p: { id: string | number; data: UpdateEmployeeInput }) =>
      api.put(`/employees/${p.id}`, p.data),
    onSuccess: invalidate,
  });
  const deleteMutation = useMutation({
    mutationFn: async (id: string | number) => api.del(`/employees/${id}`),
    onSuccess: invalidate,
  });

  return {
    employees: listQuery.data ?? [],
    isLoading: listQuery.isLoading,
    createEmployee: (data: CreateEmployeeInput) => createMutation.mutateAsync(data),
    updateEmployee: (id: string | number, data: UpdateEmployeeInput) =>
      updateMutation.mutateAsync({ id, data }),
    deleteEmployee: (id: string | number) => deleteMutation.mutateAsync(id),
  };
}
