'use client';

import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Calendar, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useSuppliersRealtime } from '@/lib/react-query/useSuppliersRealtime';
import { useSupplierCredits } from '@/lib/hooks/useSupplierCredits';
import { toast } from 'sonner';

interface ManualSupplierCreditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManualSupplierCreditDialog({ open, onOpenChange }: ManualSupplierCreditDialogProps) {
  const { suppliers } = useSuppliersRealtime();
  const { createCredit } = useSupplierCredits();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [amount, setAmount] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [description, setDescription] = useState('');

  const filteredSuppliers = useMemo(() => {
    if (!supplierSearch || supplierSearch.length < 2) return [];
    const search = supplierSearch.toLowerCase();
    return suppliers.filter(s =>
      s.name.toLowerCase().includes(search) ||
      (s.phone && s.phone.toLowerCase().includes(search))
    );
  }, [suppliers, supplierSearch]);

  const selectedSupplier = useMemo(() => {
    return suppliers.find(s => s.id === selectedSupplierId);
  }, [suppliers, selectedSupplierId]);

  const handleSubmit = async () => {
    if (!selectedSupplierId || !selectedSupplier || !amount || parseFloat(amount) <= 0) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    setIsSubmitting(true);
    try {
      await createCredit({
        supplierId: selectedSupplierId,
        supplierName: selectedSupplier.name,
        amount: parseFloat(amount),
        date: selectedDate,
        notes: description || undefined,
      });

      toast.success('Crédit fournisseur créé avec succès');
      handleClose();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la création du crédit');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedSupplierId(null);
    setSupplierSearch('');
    setAmount('');
    setSelectedDate(new Date());
    setDescription('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Nouveau crédit fournisseur</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Sélecteur de fournisseur */}
          <div className="space-y-2">
            <Label>Fournisseur *</Label>
            <div className="relative">
              <Input
                placeholder="Rechercher un fournisseur par nom ou téléphone... (min. 2 caractères)"
                value={selectedSupplier ? selectedSupplier.name : supplierSearch}
                onChange={(e) => {
                  const value = e.target.value;
                  setSupplierSearch(value);
                  setShowSupplierDropdown(true);
                  if (selectedSupplierId) {
                    setSelectedSupplierId(null);
                  }
                }}
                onFocus={() => {
                  if (!selectedSupplierId) setShowSupplierDropdown(true);
                }}
                onBlur={() => setTimeout(() => setShowSupplierDropdown(false), 200)}
              />
              {showSupplierDropdown && supplierSearch.length >= 2 && !selectedSupplierId && filteredSuppliers.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {filteredSuppliers.map((supplier) => (
                    <div
                      key={supplier.id}
                      className="px-3 py-2 hover:bg-muted cursor-pointer flex flex-col"
                      onPointerDown={() => {
                        setSelectedSupplierId(supplier.id);
                        setSupplierSearch(supplier.name);
                        setShowSupplierDropdown(false);
                      }}
                    >
                      <span className="font-medium">{supplier.name}</span>
                      {supplier.phone && (
                        <span className="text-xs text-muted-foreground">{supplier.phone}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Montant */}
          <div className="space-y-2">
            <Label>Montant de la dette (FCFA) *</Label>
            <Input
              type="number"
              placeholder="0"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label>Date du crédit</Label>
            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Calendar className="h-4 w-4" />
                  {format(selectedDate, 'dd/MM/yyyy', { locale: fr })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    if (date) {
                      setSelectedDate(date);
                      setIsCalendarOpen(false);
                    }
                  }}
                  locale={fr}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Description (optionnel)</Label>
            <Textarea
              placeholder="Notes ou description du crédit..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !selectedSupplierId || !amount}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Création...
              </>
            ) : (
              'Créer le crédit'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
