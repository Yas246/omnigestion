'use client';

import { useState, useEffect } from 'react';
import { doc, setDoc, getDocs, collection, deleteDoc, query, where } from 'firebase/firestore';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Plus, UserPlus, Shield, Trash2, Pencil, X } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { db } from '@/lib/firebase';
import type { User } from '@/types';

type Permission = {
  module: string;
  actions: string[];
};

const AVAILABLE_PERMISSIONS = [
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
    label: 'Crédits',
    actions: [
      { value: 'read', label: 'Voir les crédits' },
      { value: 'create', label: 'Créer crédits/fournisseurs' },
      { value: 'update', label: 'Modifier crédits/fournisseurs' },
      { value: 'payment', label: 'Enregistrer paiements' },
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

export function UsersTab() {
  const { user: currentUser } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [showPasswordField, setShowPasswordField] = useState(false);

  // Formulaire création utilisateur
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [position, setPosition] = useState('');
  const [role, setRole] = useState<'admin' | 'employee'>('employee');
  const [permissions, setPermissions] = useState<Permission[]>([]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    if (!currentUser?.currentCompanyId) return;

    setLoading(true);
    try {
      const q = query(
        collection(db, 'users'),
        where('companyIds', 'array-contains', currentUser.currentCompanyId)
      );
      const snapshot = await getDocs(q);
      const usersData = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as User)
      );
      setUsers(usersData);
    } catch (error) {
      console.error('Erreur lors du chargement des utilisateurs:', error);
      toast.error('Erreur lors du chargement des utilisateurs');
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = (module: string, action: string) => {
    setPermissions((prev) => {
      const moduleIndex = prev.findIndex((p) => p.module === module);

      if (moduleIndex === -1) {
        // Module pas encore sélectionné, on l'ajoute avec l'action
        return [...prev, { module, actions: [action] }];
      }

      // Module existe déjà, on crée une copie pour éviter la mutation
      const modulePerm = prev[moduleIndex];
      const actionExists = modulePerm.actions.includes(action);

      if (actionExists) {
        // Retirer l'action
        const newActions = modulePerm.actions.filter((a) => a !== action);
        if (newActions.length === 0) {
          // Si plus d'actions, retirer le module
          return prev.filter((p) => p.module !== module);
        }
        // Retourner nouveau tableau avec module mis à jour
        return prev.map((p, i) =>
          i === moduleIndex ? { ...p, actions: newActions } : p
        );
      } else {
        // Ajouter l'action - retourner nouveau tableau avec module mis à jour
        return prev.map((p, i) =>
          i === moduleIndex
            ? { ...p, actions: [...p.actions, action] }
            : p
        );
      }
    });
  };

  const hasPermission = (module: string, action: string) => {
    const perm = permissions.find((p) => p.module === module);
    return perm?.actions.includes(action) || false;
  };

  const handleCreateUser = async () => {
    // Validation
    if (!firstName || !lastName || !email || (!editingUserId && !password) || !phone || !position) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (!editingUserId && password.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    if (role === 'employee' && permissions.length === 0) {
      toast.error('Veuillez sélectionner au moins une permission pour l\'employé');
      return;
    }

    // Vérifier que l'utilisateur courant est admin
    if (currentUser?.role !== 'admin') {
      toast.error('Seuls les administrateurs peuvent gérer les utilisateurs');
      return;
    }

    setIsCreating(true);
    try {
      if (editingUserId) {
        // Mode édition - mettre à jour l'utilisateur
        const response = await fetch('/api/auth/update-user', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: editingUserId,
            firstName,
            lastName,
            phone,
            position,
            role,
            permissions,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Erreur lors de la mise à jour de l\'utilisateur');
        }

        // Si un nouveau mot de passe est fourni, le mettre à jour
        if (password && showPasswordField) {
          const passwordResponse = await fetch('/api/auth/update-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: editingUserId,
              newPassword: password,
            }),
          });

          const passwordData = await passwordResponse.json();

          if (!passwordResponse.ok) {
            throw new Error(passwordData.error || 'Erreur lors de la mise à jour du mot de passe');
          }
        }

        toast.success('Utilisateur mis à jour avec succès');
      } else {
        // Mode création - créer un nouvel utilisateur
        const response = await fetch('/api/auth/create-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            password,
            firstName,
            lastName,
            phone,
            position,
            role,
            permissions,
            companyId: currentUser?.currentCompanyId,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Erreur lors de la création de l\'utilisateur');
        }

        toast.success('Utilisateur créé avec succès');
      }

      setIsDialogOpen(false);
      resetForm();
      await fetchUsers(); // Recharger la liste
    } catch (error: any) {
      console.error('Erreur:', error);
      toast.error(error.message || 'Une erreur est survenue');
    } finally {
      setIsCreating(false);
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUserId(user.id);
    setFirstName(user.firstName || '');
    setLastName(user.lastName || '');
    setEmail(user.email || '');
    setPassword('');
    setPhone(user.phone || '');
    setPosition(user.position || '');
    setRole(user.role);
    setPermissions(user.permissions || []);
    setShowPasswordField(false);
    setIsDialogOpen(true);
  };

  const handleDeleteUser = async (userId: string) => {
    // Vérifier que l'utilisateur courant est admin
    if (currentUser?.role !== 'admin') {
      toast.error('Seuls les administrateurs peuvent supprimer des utilisateurs');
      return;
    }

    if (userId === currentUser?.id) {
      toast.error('Vous ne pouvez pas supprimer votre propre compte');
      return;
    }

    // Vérifier que l'utilisateur à supprimer n'est pas admin
    const userToDelete = users.find((u) => u.id === userId);
    if (userToDelete?.role === 'admin') {
      toast.error('Vous ne pouvez pas supprimer un compte administrateur');
      return;
    }

    if (!confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'users', userId));
      toast.success('Utilisateur supprimé');
      await fetchUsers();
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const resetForm = () => {
    setEditingUserId(null);
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

  const getUserInitials = (user: User) => {
    const displayName = user.displayName || user.email || '';
    return displayName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
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
                Gérez les accès de votre équipe ({users.length} utilisateur{users.length > 1 ? 's' : ''})
              </CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Créer un utilisateur
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingUserId ? 'Modifier l\'utilisateur' : 'Créer un utilisateur'}
                  </DialogTitle>
                  <DialogDescription>
                    {editingUserId
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
                        <Input
                          id="lastName"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          placeholder="Dupont"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="firstName">Prénom *</Label>
                        <Input
                          id="firstName"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="Jean"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="position">Poste occupé *</Label>
                        <Input
                          id="position"
                          value={position}
                          onChange={(e) => setPosition(e.target.value)}
                          placeholder="Vendeur, Gérant..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Téléphone *</Label>
                        <Input
                          id="phone"
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+241 XX XX XX XX"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Informations de connexion */}
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
                          disabled={!!editingUserId}
                          className={editingUserId ? 'bg-muted' : ''}
                        />
                        {editingUserId && (
                          <p className="text-xs text-muted-foreground">L\'email ne peut pas être modifié</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        {editingUserId ? (
                          <>
                            <div className="flex items-center justify-between">
                              <Label htmlFor="password">Mot de passe</Label>
                              <button
                                type="button"
                                onClick={() => setShowPasswordField(!showPasswordField)}
                                className="text-xs text-primary hover:underline"
                              >
                                {showPasswordField ? 'Annuler' : 'Changer le mot de passe'}
                              </button>
                            </div>
                            {showPasswordField ? (
                              <>
                                <PasswordInput
                                  id="password"
                                  value={password}
                                  onChange={(e) => setPassword(e.target.value)}
                                  placeholder="Nouveau mot de passe (laisser vide pour ne pas changer)"
                                />
                                <p className="text-xs text-muted-foreground">Minimum 6 caractères. Laissez vide pour ne pas changer le mot de passe.</p>
                              </>
                            ) : (
                              <p className="text-sm text-muted-foreground py-2">••••••••</p>
                            )}
                          </>
                        ) : (
                          <>
                            <Label htmlFor="password">Mot de passe *</Label>
                            <PasswordInput
                              id="password"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              placeholder="••••••••"
                            />
                            <p className="text-xs text-muted-foreground">Minimum 6 caractères</p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Rôle */}
                  <div className="space-y-4">
                    <h3 className="font-semibold">Rôle et permissions</h3>
                    <div className="space-y-2">
                      <Label htmlFor="role">Rôle *</Label>
                      <Select value={role} onValueChange={(value: 'admin' | 'employee') => setRole(value)}>
                        <SelectTrigger id="role">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="employee">Employé</SelectItem>
                          <SelectItem value="admin">Administrateur</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {role === 'admin'
                          ? 'Accès complet à tous les modules et paramètres'
                          : 'Accès limité selon les permissions ci-dessous'}
                      </p>
                    </div>

                    {/* Permissions granulaires pour employés */}
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
                                const isSelected = hasPermission(perm.module, action.value);
                                return (
                                  <button
                                    key={action.value}
                                    type="button"
                                    onClick={() => togglePermission(perm.module, action.value)}
                                    className={`px-3 py-2 text-xs rounded-md border transition-all flex items-center gap-2 ${
                                      isSelected
                                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                        : 'bg-background hover:bg-muted border-border'
                                    }`}
                                  >
                                    <span className={isSelected ? '' : 'w-4 h-4 rounded border border-current flex items-center justify-center'}>
                                      {isSelected && '✓'}
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
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => { setIsDialogOpen(false); resetForm(); }}
                    >
                      Annuler
                    </Button>
                    <Button onClick={handleCreateUser} disabled={isCreating}>
                      {isCreating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {editingUserId ? 'Modification...' : 'Création...'}
                        </>
                      ) : (
                        <>
                          {editingUserId ? (
                            <>
                              <Pencil className="mr-2 h-4 w-4" />
                              Modifier l&apos;utilisateur
                            </>
                          ) : (
                            <>
                              <UserPlus className="mr-2 h-4 w-4" />
                              Créer l&apos;utilisateur
                            </>
                          )}
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
          {users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Shield className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">
                Aucun utilisateur. Créez le premier compte pour votre équipe.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {getUserInitials(user)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{user.displayName || user.email}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                      {user.position && (
                        <p className="text-xs text-muted-foreground">{user.position}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Shield className="h-4 w-4" />
                      <span className="capitalize">
                        {user.role === 'admin' ? 'Administrateur' : 'Employé'}
                      </span>
                    </div>

                    <div className="flex gap-2">
                      {user.id !== currentUser?.id && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditUser(user)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteUser(user.id)}
                          >
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
            <h4 className="mb-2 font-medium">Administrateur</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>• Accès complet à tous les modules</li>
              <li>• Gestion des paramètres de l&apos;entreprise</li>
              <li>• Gestion des utilisateurs et des permissions</li>
              <li>• Accès aux rapports financiers</li>
              <li>• Gestion des sauvegardes</li>
            </ul>
          </div>

          <div>
            <h4 className="mb-2 font-medium">Employé</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>• Accès limité selon les permissions attribuées</li>
              <li>• Permissions granulaires par module et par action</li>
              <li>• Pas d&apos;accès aux paramètres de l&apos;entreprise</li>
              <li>• Pas d&apos;accès à la gestion des utilisateurs</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
