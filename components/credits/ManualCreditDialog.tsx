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
import { useClientsRealtime } from '@/lib/react-query/useClientsRealtime';
import { useClientCredits } from '@/lib/hooks/useClientCredits';
import { toast } from 'sonner';

interface ManualCreditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManualCreditDialog({ open, onOpenChange }: ManualCreditDialogProps) {
  const { clients } = useClientsRealtime();
  const { createCredit } = useClientCredits();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [amount, setAmount] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [description, setDescription] = useState('');

  const filteredClients = useMemo(() => {
    if (!clientSearch || clientSearch.length < 2) return [];
    const search = clientSearch.toLowerCase();
    return clients.filter(c =>
      c.name.toLowerCase().includes(search) ||
      (c.phone && c.phone.toLowerCase().includes(search))
    );
  }, [clients, clientSearch]);

  const selectedClient = useMemo(() => {
    return clients.find(c => c.id === selectedClientId);
  }, [clients, selectedClientId]);

  const handleSubmit = async () => {
    if (!selectedClientId || !selectedClient || !amount || parseFloat(amount) <= 0) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    setIsSubmitting(true);
    try {
      await createCredit({
        clientId: selectedClientId,
        clientName: selectedClient.name,
        amount: parseFloat(amount),
        date: selectedDate,
        notes: description || undefined,
      });

      toast.success('Crédit client créé avec succès');
      handleClose();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la création du crédit');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedClientId(null);
    setClientSearch('');
    setAmount('');
    setSelectedDate(new Date());
    setDescription('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Nouveau crédit client</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Sélecteur de client */}
          <div className="space-y-2">
            <Label>Client *</Label>
            <div className="relative">
              <Input
                placeholder="Rechercher un client par nom ou téléphone... (min. 2 caractères)"
                value={selectedClient ? selectedClient.name : clientSearch}
                onChange={(e) => {
                  const value = e.target.value;
                  setClientSearch(value);
                  setShowClientDropdown(true);
                  if (selectedClientId) {
                    setSelectedClientId(null);
                  }
                }}
                onFocus={() => {
                  if (!selectedClientId) setShowClientDropdown(true);
                }}
                onBlur={() => setTimeout(() => setShowClientDropdown(false), 200)}
              />
              {showClientDropdown && clientSearch.length >= 2 && !selectedClientId && filteredClients.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {filteredClients.map((client) => (
                    <div
                      key={client.id}
                      className="px-3 py-2 hover:bg-muted cursor-pointer flex flex-col"
                      onPointerDown={() => {
                        setSelectedClientId(client.id);
                        setClientSearch(client.name);
                        setShowClientDropdown(false);
                      }}
                    >
                      <span className="font-medium">{client.name}</span>
                      {client.phone && (
                        <span className="text-xs text-muted-foreground">{client.phone}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Montant */}
          <div className="space-y-2">
            <Label>Montant du crédit (FCFA) *</Label>
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
          <Button onClick={handleSubmit} disabled={isSubmitting || !selectedClientId || !amount}>
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
