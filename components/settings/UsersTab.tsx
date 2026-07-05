'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Plus, UserPlus, Shield, Trash2, Pencil } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useEmployees, type ApiEmployee } from '@/lib/api/employees';
import type { Permission } from '@/types';

// The full permission catalog. MUST stay in sync with the backend employee
// validator action enum (app/validators/employee.ts).
const AVAILABLE_PERMISSIONS = [
  {
    module: 'dashboard',
    label: 'Tableau de bord',
    actions: [{ value: 'read', label: 'Voir le tableau de bord' }],
  },
  {
    module: 'sales',
    label: 'Ventes',
    actions: [
      { value: 'read', label: 'Voir les ventes' },
      { value: 'create', label: 'Créer des factures' },
      { value: 'delete', label: 'Annuler/Supprimer' },
    ],
  },
  {
    module: 'stock',
    label: 'Stock',
    actions: [
      { value: 'read', label: 'Voir les produits' },
      { value: 'create', label: 'Créer des produits' },
      { value: 'update', label: 'Modifier des produits' },
      { value: 'delete', label: 'Supprimer des produits' },
      { value: 'restock', label: 'Approvisionner le stock' },
      { value: 'transfer', label: 'Transferts entre dépôts' },
      { value: 'loss', label: 'Enregistrer les pertes' },
      { value: 'movements', label: 'Voir les mouvements' },
    ],
  },
  {
    module: 'cash',
    label: 'Caisse',
    actions: [
      { value: 'read', label: 'Voir les opérations' },
      { value: 'create', label: 'Enregistrer entrées/sorties' },
    ],
  },
  {
    module: 'clients',
    label: 'Clientèle',
    actions: [
      { value: 'read', label: 'Voir les clients' },
      { value: 'create', label: 'Créer des clients' },
      { value: 'update', label: 'Modifier des clients' },
      { value: 'delete', label: 'Supprimer des clients' },
    ],
  },
  {
    module: 'credits',
    label: 'Crédits clients',
    actions: [
      { value: 'read', label: 'Voir les crédits clients' },
      { value: 'payment', label: 'Enregistrer les paiements' },
    ],
  },
  {
    module: 'suppliers',
    label: 'Fournisseurs',
    actions: [
      { value: 'read', label: 'Voir les fournisseurs' },
      { value: 'create', label: 'Créer des fournisseurs' },
      { value: 'purchase', label: 'Créer des achats' },
      { value: 'update', label: 'Modifier des fournisseurs' },
      { value: 'delete', label: 'Supprimer des fournisseurs' },
      { value: 'payment', label: 'Enregistrer les paiements' },
    ],
  },
  {
    module: 'reports',
    label: 'Rapports',
    actions: [{ value: 'read', label: 'Voir les rapports' }],
  },
  {
    module: 'settings',
    label: 'Paramètres',
    actions: [
      { value: 'read', label: 'Voir les paramètres' },
      { value: 'update', label: 'Modifier les paramètres' },
    ],
  },
];

/** "Accès total" preset = every module with every available action. The owner
 *  is the only true admin (is_owner); an "admin" employee is simply one granted
 *  every permission. */
const ALL_PERMISSIONS: Permission[] = AVAILABLE_PERMISSIONS.map((p) => ({
  module: p.module,
  actions: p.actions.map((a) => a.value),
}));

function isFullPermissions(perms: Permission[]): boolean {
  return AVAILABLE_PERMISSIONS.every((mod) => {
    const p = perms.find((x) => x.module === mod.module);
    return !!p && mod.actions.every((a) => p.actions.includes(a.value));
  });
}

function splitName(fullName: string | null): { firstName: string; lastName: string } {
  if (!fullName) return { firstName: '', lastName: '' };
  const parts = fullName.trim().split(/\s+/);
  return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') };
}

export function UsersTab() {
  const { user: currentUser } = useAuth();
  const { employees, isLoading, createEmployee, updateEmployee, deleteEmployee } = useEmployees();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showPasswordField, setShowPasswordField] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [position, setPosition] = useState('');
  const [role, setRole] = useState<'admin' | 'employee'>('employee');
  const [permissions, setPermissions] = useState<Permission[]>([]);

  const togglePermission = (module: string, action: string) => {
    setPermissions((prev) => {
      const i = prev.findIndex((p) => p.module === module);
      if (i === -1) return [...prev, { module, actions: [action] }];
      const mod = prev[i];
      const has = mod.actions.includes(action);
      const actions = has ? mod.actions.filter((a) => a !== action) : [...mod.actions, action];
      return actions.length === 0
        ? prev.filter((p) => p.module !== module)
        : prev.map((p, idx) => (idx === i ? { ...p, actions } : p));
    });
  };

  const hasPerm = (module: string, action: string) =>
    !!permissions.find((p) => p.module === module)?.actions.includes(action);

  const resetForm = () => {
    setEditingId(null);
    setFirstName('');
    setLastName('');
    setEmail('');
    setPassword('');
    setPhone('');
    setPosition('');
    setRole('employee');
    setPermissions([]);
    setShowPasswordField(false);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleEdit = (emp: ApiEmployee) => {
    const { firstName, lastName } = splitName(emp.fullName);
    setEditingId(emp.id);
    setFirstName(firstName);
    setLastName(lastName);
    setEmail(emp.email ?? '');
    setPassword('');
    setPhone(emp.phone ?? '');
    setPosition(emp.position ?? '');
    const perms = emp.permissions ?? [];
    setRole(isFullPermissions(perms) ? 'admin' : 'employee');
    setPermissions(perms);
    setShowPasswordField(false);
    setIsDialogOpen(true);
  };

  const handleDelete = async (emp: ApiEmployee) => {
    if (emp.isOwner) {
      toast.error('Vous ne pouvez pas supprimer le compte propriétaire');
      return;
    }
    if (String(emp.userId) === currentUser?.id) {
      toast.error('Vous ne pouvez pas supprimer votre propre compte');
      return;
    }
    if (!confirm('Êtes-vous sûr de vouloir retirer cet utilisateur ?')) return;
    try {
      await deleteEmployee(emp.id);
      toast.success('Utilisateur retiré');
    } catch (err: any) {
      toast.error(err?.message || 'Erreur lors de la suppression');
    }
  };

  const handleSubmit = async () => {
    if (!firstName || !lastName || !email || (!editingId && !password)) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }
    if (!editingId && password.length < 8) {
      toast.error('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }
    if (currentUser?.role !== 'admin') {
      toast.error('Seuls les administrateurs peuvent gérer les utilisateurs');
      return;
    }

    const fullName = `${firstName} ${lastName}`.trim();
    const finalPermissions = role === 'admin' ? ALL_PERMISSIONS : permissions;
    if (role === 'employee' && finalPermissions.length === 0) {
      toast.error("Veuillez sélectionner au moins une permission pour l'employé");
      return;
    }

    setIsSaving(true);
    try {
      if (editingId) {
        await updateEmployee(editingId, {
          fullName,
          position: position || undefined,
          phone: phone || undefined,
          permissions: finalPermissions,
          ...(password && showPasswordField ? { password } : {}),
        });
        toast.success('Utilisateur mis à jour avec succès');
      } else {
        await createEmployee({
          fullName,
          email,
          password,
          position: position || undefined,
          phone: phone || undefined,
          permissions: finalPermissions,
        });
        toast.success('Utilisateur créé avec succès');
      }
      setIsDialogOpen(false);
      resetForm();
    } catch (err: any) {
      toast.error(err?.message || 'Une erreur est survenue');
    } finally {
      setIsSaving(false);
    }
  };

  const getUserInitials = (emp: ApiEmployee) =>
    (emp.fullName || emp.email || '')
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Liste des utilisateurs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Utilisateurs</CardTitle>
              <CardDescription>
                Gérez les accès de votre équipe ({employees.length} utilisateur{employees.length > 1 ? 's' : ''})
              </CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button onClick={handleOpenCreate}>
                  <Plus className="mr-2 h-4 w-4" />
                  Créer un utilisateur
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingId ? 'Modifier l\'utilisateur' : 'Créer un utilisateur'}</DialogTitle>
                  <DialogDescription>
                    {editingId
                      ? 'Modifiez les informations et permissions de l\'utilisateur'
                      : 'Créez un compte pour un membre de votre équipe'}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                  {/* Informations personnelles */}
                  <div className="space-y-4">
                    <h3 className="font-semibold">Informations personnelles</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Nom *</Label>
                        <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Dupont" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="firstName">Prénom *</Label>
                        <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jean" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="position">Poste occupé</Label>
                        <Input id="position" value={position} onChange={(e) => setPosition(e.target.value)} placeholder="Vendeur, Gérant..." />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Téléphone</Label>
                        <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+241 XX XX XX XX" />
                      </div>
                    </div>
                  </div>

                  {/* Connexion */}
                  <div className="space-y-4">
                    <h3 className="font-semibold">Connexion</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="email">Email *</Label>
                        <Input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="nom@exemple.com"
                          disabled={!!editingId}
                          className={editingId ? 'bg-muted' : ''}
                        />
                        {editingId && <p className="text-xs text-muted-foreground">L&apos;email ne peut pas être modifié</p>}
                      </div>
                      <div className="space-y-2">
                        {editingId ? (
                          <>
                            <div className="flex items-center justify-between">
                              <Label htmlFor="password">Mot de passe</Label>
                              <button type="button" onClick={() => setShowPasswordField(!showPasswordField)} className="text-xs text-primary hover:underline">
                                {showPasswordField ? 'Annuler' : 'Changer le mot de passe'}
                              </button>
                            </div>
                            {showPasswordField ? (
                              <>
                                <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Nouveau mot de passe" />
                                <p className="text-xs text-muted-foreground">Minimum 8 caractères.</p>
                              </>
                            ) : (
                              <p className="text-sm text-muted-foreground py-2">••••••••</p>
                            )}
                          </>
                        ) : (
                          <>
                            <Label htmlFor="password">Mot de passe *</Label>
                            <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                            <p className="text-xs text-muted-foreground">Minimum 8 caractères</p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Rôle (preset de permissions) */}
                  <div className="space-y-4">
                    <h3 className="font-semibold">Rôle et permissions</h3>
                    <div className="space-y-2">
                      <Label htmlFor="role">Niveau d&apos;accès *</Label>
                      <Select value={role} onValueChange={(v: 'admin' | 'employee') => setRole(v)}>
                        <SelectTrigger id="role"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="employee">Employé</SelectItem>
                          <SelectItem value="admin">Accès total</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {role === 'admin'
                          ? 'Toutes les permissions sont accordées (équivalent administrateur).'
                          : 'Accès limité selon les permissions ci-dessous'}
                      </p>
                    </div>

                    {role === 'employee' && (
                      <div className="space-y-4 mt-4 p-4 border rounded-lg bg-muted/30">
                        <div className="flex items-center justify-between">
                          <Label>Permissions</Label>
                          <p className="text-xs text-muted-foreground">Cochez toutes les permissions applicables</p>
                        </div>
                        {AVAILABLE_PERMISSIONS.map((perm) => (
                          <div key={perm.module} className="space-y-2">
                            <p className="text-sm font-medium">{perm.label}</p>
                            <div className="flex flex-wrap gap-2">
                              {perm.actions.map((action) => {
                                const selected = hasPerm(perm.module, action.value);
                                return (
                                  <button
                                    key={action.value}
                                    type="button"
                                    onClick={() => togglePermission(perm.module, action.value)}
                                    className={`px-3 py-2 text-xs rounded-md border transition-all flex items-center gap-2 ${
                                      selected
                                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                        : 'bg-background hover:bg-muted border-border'
                                    }`}
                                  >
                                    <span className={selected ? '' : 'w-4 h-4 rounded border border-current flex items-center justify-center'}>
                                      {selected && '✓'}
                                    </span>
                                    <span>{action.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }}>
                      Annuler
                    </Button>
                    <Button onClick={handleSubmit} disabled={isSaving}>
                      {isSaving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {editingId ? 'Modification...' : 'Création...'}
                        </>
                      ) : (
                        <>
                          {editingId ? <><Pencil className="mr-2 h-4 w-4" />Modifier l&apos;utilisateur</> : <><UserPlus className="mr-2 h-4 w-4" />Créer l&apos;utilisateur</>}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {employees.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Shield className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">
                Aucun utilisateur. Créez le premier compte pour votre équipe.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {employees.map((emp) => (
                <div key={emp.id} className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback className="bg-primary/10 text-primary">{getUserInitials(emp)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{emp.fullName || emp.email}</p>
                      <p className="text-sm text-muted-foreground">{emp.email}</p>
                      {emp.position && <p className="text-xs text-muted-foreground">{emp.position}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Shield className="h-4 w-4" />
                      <span className="capitalize">
                        {emp.isOwner || isFullPermissions(emp.permissions ?? []) ? 'Administrateur' : 'Employé'}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      {!emp.isOwner && (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(emp)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(emp)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Informations sur les rôles */}
      <Card>
        <CardHeader>
          <CardTitle>À propos des rôles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="mb-2 font-medium">Propriétaire / Accès total</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>• Le propriétaire du compte a accès à toutes les compagnies et tous les modules</li>
              <li>• Un employé « Accès total » dispose de toutes les permissions sur la compagnie</li>
              <li>• Gestion des utilisateurs et des permissions</li>
            </ul>
          </div>
          <div>
            <h4 className="mb-2 font-medium">Employé</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>• Accès limité selon les permissions attribuées</li>
              <li>• Permissions granulaires par module et par action</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
