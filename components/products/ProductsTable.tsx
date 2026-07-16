"use client";

import { useState, useMemo } from "react";
import type { Product, Warehouse } from "@/types";
import { useProductDisplayStock } from "@/lib/api/hooks/useProducts";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Edit,
  Trash2,
  Search,
  Package,
  AlertCircle,
  Filter,
  ArrowRight,
  Plus,
  XCircle,
  X,
  History,
  MoreHorizontal,
} from "lucide-react";
import { PermissionGate } from "@/components/auth";
import { useDebounce } from "@/lib/hooks/useDebounce";

interface ProductsTableProps {
  products: Array<Product & { displayQuantity?: number }>;
  warehouses: Warehouse[];
  loading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onFilterByWarehouse?: (warehouseId: string | null) => void;
  onEdit?: (product: Product) => void;
  onDelete?: (id: string) => void;
  onTransfer?: (product: Product) => void;
  onRestock?: (product: Product) => void;
  onRecordLoss?: (product: Product) => void;
  onFilterByStatus?: (
    status: "all" | "ok" | "low" | "out" | "inactive",
  ) => void;
  onViewHistory?: (product: Product) => void;
  totalLoaded?: number; // Nombre total de produits chargés depuis Firestore
}

export function ProductsTable({
  products,
  warehouses,
  loading = false,
  hasMore = false,
  onLoadMore,
  onFilterByWarehouse,
  onEdit,
  onDelete,
  onTransfer,
  onRestock,
  onRecordLoss,
  onFilterByStatus,
  onViewHistory,
  totalLoaded = 0,
}: ProductsTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedWarehouse, setSelectedWarehouse] = useState<string | null>(
    null,
  );
  const [selectedStatus, setSelectedStatus] = useState<
    "all" | "ok" | "low" | "out" | "inactive"
  >("all");

  // Auth pour avoir le companyId
  const { user } = useAuth();

  // Hook pour obtenir le stock d'affichage (avec filtre entrepôt)
  const { getDisplayStock } = useProductDisplayStock();

  // Filtrer les produits par recherche et statut (côté client)
  // IMPORTANT: Utiliser useMemo pour éviter les boucles infinies de re-render
  const filteredProducts = useMemo(() => {
    let filtered = products;

    // Filtre par statut
    if (selectedStatus !== "all") {
      filtered = filtered.filter((product) => {
        const isActive = product.isActive ?? true;

        switch (selectedStatus) {
          case "ok":
            return isActive && product.status === "ok";
          case "low":
            return isActive && product.status === "low";
          case "out":
            return isActive && product.currentStock === 0;
          case "inactive":
            return !isActive;
          default:
            return true;
        }
      });
    }

    // Filtre par recherche (si minimum 3 caractères)
    if (searchTerm.length >= 3) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(searchLower) ||
          (p.code && p.code.toLowerCase().includes(searchLower)) ||
          (p.category && p.category.toLowerCase().includes(searchLower)),
      );
    }

    return filtered;
  }, [products, selectedStatus, searchTerm]); // Dépendances correctes

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
  };

  const handleClearSearch = () => {
    setSearchTerm("");
  };

  const handleWarehouseFilter = (warehouseId: string) => {
    const newFilter = warehouseId === "all" ? null : warehouseId;
    setSelectedWarehouse(newFilter);
    if (onFilterByWarehouse) {
      onFilterByWarehouse(newFilter);
    }
  };

  const handleStatusFilter = (
    status: "all" | "ok" | "low" | "out" | "inactive",
  ) => {
    setSelectedStatus(status);
    if (onFilterByStatus) {
      onFilterByStatus(status);
    }
  };

  const getStatusBadge = (status: "ok" | "low" | "out", isActive: boolean) => {
    if (!isActive) {
      return <Badge variant="secondary">Inactif</Badge>;
    }

    switch (status) {
      case "out":
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            Rupture
          </Badge>
        );
      case "low":
        return (
          <Badge variant="warning" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            Stock faible
          </Badge>
        );
      default:
        return <Badge variant="success" className="gap-1">En stock</Badge>;
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "XOF",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  // Actions produit réutilisées par la cellule table (desktop) et la carte (mobile).
  // - compact (desktop) : bouton vert « + » + kebab, alignés à droite.
  // - full (mobile)     : bouton vert « Approvisionner » pleine largeur + kebab (zéro vide).
  const renderActions = (product: Product, variant: "compact" | "full" = "compact") => (
    <div className={variant === "full" ? "flex items-center gap-2" : "flex items-center justify-end gap-1"}>
      <PermissionGate module="stock" action="restock">
        {onRestock && (
          <Button
            variant="ghost"
            size={variant === "full" ? "default" : "icon"}
            onClick={() => onRestock(product)}
            title="Approvisionner"
            className={
              variant === "full"
                ? "flex-1 gap-2 bg-[oklch(0.55_0.15_145)] text-white hover:bg-[oklch(0.48_0.15_145)]"
                : "rounded-lg bg-[oklch(0.65_0.12_145)]/15 text-[oklch(0.42_0.11_145)] hover:bg-[oklch(0.65_0.12_145)]/25 dark:bg-[oklch(0.65_0.12_145)]/20 dark:text-[oklch(0.80_0.14_145)] dark:hover:bg-[oklch(0.65_0.12_145)]/30"
            }
          >
            <Plus className="h-4 w-4" />
            {variant === "full" && <span>Approvisionner</span>}
          </Button>
        )}
      </PermissionGate>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" title="Plus d’actions" className="shrink-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <PermissionGate module="stock" action="update">
            {onEdit && (
              <DropdownMenuItem onClick={() => onEdit(product)}>
                <Edit className="mr-2 h-4 w-4" /> Modifier
              </DropdownMenuItem>
            )}
          </PermissionGate>
          <PermissionGate module="stock" action="loss">
            {onRecordLoss && (
              <DropdownMenuItem onClick={() => onRecordLoss(product)}>
                <XCircle className="mr-2 h-4 w-4" /> Enregistrer une perte
              </DropdownMenuItem>
            )}
          </PermissionGate>
          <PermissionGate module="stock" action="transfer">
            {onTransfer && (
              <DropdownMenuItem onClick={() => onTransfer(product)}>
                <ArrowRight className="mr-2 h-4 w-4" /> Transférer
              </DropdownMenuItem>
            )}
          </PermissionGate>
          {onViewHistory && (
            <DropdownMenuItem onClick={() => onViewHistory(product)}>
              <History className="mr-2 h-4 w-4" /> Historique
            </DropdownMenuItem>
          )}
          <PermissionGate module="stock" action="delete">
            {onDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(product.id)}>
                  <Trash2 className="mr-2 h-4 w-4" /> Supprimer
                </DropdownMenuItem>
              </>
            )}
          </PermissionGate>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Recherche et filtres */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom, code... (min. 3 caractères)"
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9 pr-10"
          />
          {searchTerm && (
            <button
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {warehouses && warehouses.length > 0 && (
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select
              onValueChange={handleWarehouseFilter}
              value={selectedWarehouse || "all"}
            >
              <SelectTrigger className="w-45">
                <SelectValue placeholder="Tous les dépôts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les dépôts</SelectItem>
                {warehouses.map((warehouse) => (
                  <SelectItem key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Filtre par statut */}
        <div className="flex items-center gap-2">
          <Select onValueChange={handleStatusFilter} value={selectedStatus}>
            <SelectTrigger className="w-45">
              <SelectValue placeholder="Tous les statuts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="ok">En stock</SelectItem>
              <SelectItem value="low">Stock faible</SelectItem>
              <SelectItem value="out">Rupture de stock</SelectItem>
              <SelectItem value="inactive">Inactifs</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tableau — desktop only */}
      <div className="hidden overflow-hidden rounded-xl border bg-card lg:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16 text-center">#</TableHead>
              <TableHead>Produit</TableHead>
              <TableHead className="text-right">Prix achat</TableHead>
              <TableHead className="text-right">Prix vente</TableHead>
              <TableHead className="text-center">Stock</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  Chargement...
                </TableCell>
              </TableRow>
            ) : filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Package className="h-8 w-8 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">
                      {searchTerm
                        ? "Aucun produit trouvé pour cette recherche"
                        : selectedStatus !== "all"
                          ? `Aucun produit avec ce statut`
                          : selectedWarehouse
                            ? `Aucun produit trouvé dans ce dépôt`
                            : "Aucun produit. Créez votre premier produit pour commencer."}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((product, index) => (
                <TableRow key={product.id}>
                  <TableCell className="text-center font-medium text-muted-foreground">
                    {index + 1}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{product.name}</span>
                      {product.code && (
                        <span className="text-xs text-muted-foreground">
                          {product.code}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatPrice(product.purchasePrice)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatPrice(product.retailPrice)}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="font-medium">
                      {getDisplayStock(product)}
                      {product.unit && ` ${product.unit}`}
                    </span>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(product.status, product.isActive ?? true)}
                  </TableCell>
                  <TableCell className="text-right">{renderActions(product)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Vue mobile — cartes produits */}
      <div className="space-y-3 lg:hidden">
        {loading && filteredProducts.length === 0 ? (
          <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
            Chargement...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="rounded-xl border bg-card">
            <EmptyState
              icon={<Package className="h-5 w-5" />}
              title={
                searchTerm
                  ? "Aucun produit trouvé"
                  : selectedStatus !== "all"
                    ? "Aucun produit avec ce statut"
                    : selectedWarehouse
                      ? "Aucun produit dans ce dépôt"
                      : "Aucun produit"
              }
              description="Créez votre premier produit pour commencer."
            />
          </div>
        ) : (
          filteredProducts.map((product) => (
            <div key={product.id} className="space-y-3 rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{product.name}</p>
                  {product.code && <p className="text-xs text-muted-foreground">{product.code}</p>}
                </div>
                {getStatusBadge(product.status, product.isActive ?? true)}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">Stock</p>
                  <p className="font-medium tabular-nums">
                    {getDisplayStock(product)}
                    {product.unit ? ` ${product.unit}` : ""}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Vente</p>
                  <p className="font-medium tabular-nums">{formatPrice(product.retailPrice)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Achat</p>
                  <p className="font-medium tabular-nums">{formatPrice(product.purchasePrice)}</p>
                </div>
              </div>
              <div className="border-t pt-3">{renderActions(product, "full")}</div>
            </div>
          ))
        )}
      </div>

      {/* Charger plus de produits depuis Firestore */}
      {hasMore && onLoadMore && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={onLoadMore} disabled={loading}>
            {loading
              ? "Chargement..."
              : `Charger plus de produits (${totalLoaded} chargés)`}
          </Button>
        </div>
      )}
    </div>
  );
}
