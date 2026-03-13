'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { KpiCard, KpiCardHeader, KpiCardValue } from '@/components/ui/kpi-card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCashRegisters } from '@/lib/hooks/useCashRegisters';
import { DollarSign, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { fr } from 'date-fns/locale';
import { formatPrice } from '@/lib/utils';
import { PaginatedTable } from '@/components/ui/PaginatedTable';

// Enregistrer les composants Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
);

type PeriodType = 'today' | 'week' | 'month' | 'year' | 'custom';

interface CashReportProps {
  period: PeriodType;
}

export function CashReport({ period }: CashReportProps) {
  const { movements, cashRegisters } = useCashRegisters();
  const [filteredMovements, setFilteredMovements] = useState(movements);
  const [selectedCashRegister, setSelectedCashRegister] = useState<string>('all');

  useEffect(() => {
    const now = new Date();
    now.setHours(23, 59, 59, 999); // Fin de la journée
    let startDate: Date;

    switch (period) {
      case 'today':
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate = startOfWeek(now, { weekStartsOn: 1 });
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'month':
        startDate = startOfMonth(now);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'year':
        startDate = startOfYear(now);
        startDate.setHours(0, 0, 0, 0);
        break;
      default:
        startDate = startOfMonth(now);
        startDate.setHours(0, 0, 0, 0);
    }

    let filtered = movements.filter(mov => {
      const movDate = new Date(mov.createdAt);
      return movDate >= startDate && movDate <= now;
    });

    // Filtrer par caisse si sélectionnée
    if (selectedCashRegister !== 'all') {
      filtered = filtered.filter(mov => mov.cashRegisterId === selectedCashRegister);
    }

    setFilteredMovements(filtered);
  }, [period, movements, selectedCashRegister]);

  // Calculer les totaux
  const totalIn = filteredMovements
    .filter(m => m.type === 'in' || (m.type === 'transfer' && m.sourceCashRegisterId))
    .reduce((sum, m) => sum + m.amount, 0);

  const totalOut = filteredMovements
    .filter(m => m.type === 'out' || (m.type === 'transfer' && !m.sourceCashRegisterId))
    .reduce((sum, m) => sum + m.amount, 0);

  const netFlow = totalIn - totalOut;

  // Répartition par catégorie
  const categoryDistribution: Record<string, number> = {};
  filteredMovements.forEach(mov => {
    const cat = mov.category || 'non_défini';
    categoryDistribution[cat] = (categoryDistribution[cat] || 0) + mov.amount;
  });

  const categoryLabels: Record<string, string> = {
    sale: 'Vente',
    expense: 'Dépense',
    supplier: 'Fournisseur',
    transfer: 'Transfert',
    deposit: 'Dépôt',
    withdrawal: 'Retrait',
    adjustment: 'Ajustement',
    cash: 'Espèces',
    mobile_money: 'Mobile Money',
    bank: 'Banque',
    non_défini: 'Non défini',
  };

  // Entrées par catégorie
  const inByCategory = Object.entries(categoryDistribution)
    .filter(([cat]) => {
      return filteredMovements.some(m =>
        (m.category === cat) && (m.type === 'in' || (m.type === 'transfer' && m.sourceCashRegisterId))
      );
    })
    .sort((a, b) => b[1] - a[1]);

  // Sorties par catégorie
  const outByCategory = Object.entries(categoryDistribution)
    .filter(([cat]) => {
      return filteredMovements.some(m =>
        (m.category === cat) && (m.type === 'out' || (m.type === 'transfer' && !m.sourceCashRegisterId))
      );
    })
    .sort((a, b) => b[1] - a[1]);

  const inChartData = {
    labels: inByCategory.map(([cat]) => categoryLabels[cat] || cat),
    datasets: [
      {
        label: 'Entrées (FCFA)',
        data: inByCategory.map(([, amount]) => amount),
        backgroundColor: 'rgba(34, 197, 94, 0.8)',
      },
    ],
  };

  const outChartData = {
    labels: outByCategory.map(([cat]) => categoryLabels[cat] || cat),
    datasets: [
      {
        label: 'Sorties (FCFA)',
        data: outByCategory.map(([, amount]) => amount),
        backgroundColor: 'rgba(239, 68, 68, 0.8)',
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  const selectedCashRegisterName = cashRegisters.find(cr => cr.id === selectedCashRegister)?.name || 'Toutes les caisses';

  return (
    <div className="space-y-6">
      {/* Sélecteur de caisse */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">Caisse:</span>
        <Select value={selectedCashRegister} onValueChange={setSelectedCashRegister}>
          <SelectTrigger>
            <SelectValue placeholder="Sélectionner une caisse" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les caisses</SelectItem>
            {cashRegisters.map((cr) => (
              <SelectItem key={cr.id} value={cr.id}>
                {cr.name} {cr.isMain && '(Principale)'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard variant="success">
          <KpiCardHeader
            title="Total entrées"
            icon={<TrendingUp className="h-4 w-4" />}
            iconVariant="success"
          />
          <KpiCardValue
            value={`${formatPrice(totalIn)} FCFA`}
            label="Entrées de trésorerie"
            variant="success"
          />
        </KpiCard>

        <KpiCard variant="danger">
          <KpiCardHeader
            title="Total sorties"
            icon={<TrendingDown className="h-4 w-4" />}
            iconVariant="danger"
          />
          <KpiCardValue
            value={`${formatPrice(totalOut)} FCFA`}
            label="Sorties de trésorerie"
            variant="danger"
          />
        </KpiCard>

        <KpiCard variant={netFlow >= 0 ? 'primary' : 'danger'}>
          <KpiCardHeader
            title="Flux net"
            icon={<Wallet className="h-4 w-4" />}
            iconVariant={netFlow >= 0 ? 'primary' : 'danger'}
          />
          <KpiCardValue
            value={`${formatPrice(netFlow)} FCFA`}
            label={netFlow >= 0 ? 'Excédent' : 'Déficit'}
            variant={netFlow >= 0 ? 'primary' : 'danger'}
          />
        </KpiCard>

        <KpiCard variant="info">
          <KpiCardHeader
            title="Mouvements"
            icon={<DollarSign className="h-4 w-4" />}
            iconVariant="info"
          />
          <KpiCardValue
            value={filteredMovements.length.toString()}
            label="Opérations"
            variant="info"
          />
        </KpiCard>
      </div>

      {/* Graphiques */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Entrées par catégorie */}
        <Card>
          <CardHeader>
            <CardTitle>Entrées par catégorie</CardTitle>
            <CardDescription>Répartition des entrées</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {inByCategory.length > 0 ? (
                <Bar data={inChartData} options={chartOptions} />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Aucune entrée pour cette période
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Sorties par catégorie */}
        <Card>
          <CardHeader>
            <CardTitle>Sorties par catégorie</CardTitle>
            <CardDescription>Répartition des sorties</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {outByCategory.length > 0 ? (
                <Bar data={outChartData} options={chartOptions} />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Aucune sortie pour cette période
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tableau des mouvements */}
      <Card>
        <CardHeader>
          <CardTitle>Détail des mouvements</CardTitle>
          <CardDescription>
            {selectedCashRegisterName} - {filteredMovements.length} opération(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PaginatedTable
            data={filteredMovements}
            columns={[
              {
                key: 'date',
                header: 'Date',
                render: (movement) => format(new Date(movement.createdAt), 'dd/MM/yyyy HH:mm', { locale: fr }),
              },
              {
                key: 'category',
                header: 'Catégorie',
                render: (movement) => movement.category || '-',
              },
              {
                key: 'description',
                header: 'Description',
                render: (movement) => movement.description || '-',
              },
              {
                key: 'amount',
                header: 'Montant',
                className: 'text-right',
                render: (movement) => {
                  const isIn = movement.type === 'in' || (movement.type === 'transfer' && movement.sourceCashRegisterId);
                  return (
                    <span className={`font-semibold ${isIn ? 'text-[oklch(0.65_0.12_145)]' : 'text-[oklch(0.58_0.22_25)]'}`}>
                      {isIn ? '+' : '-'}{formatPrice(movement.amount)} FCFA
                    </span>
                  );
                },
              },
              {
                key: 'type',
                header: 'Type',
                className: 'text-center',
                render: (movement) => {
                  if (movement.type === 'in') {
                    return <span className="text-[oklch(0.65_0.12_145)]">Entrée</span>;
                  } else if (movement.type === 'out') {
                    return <span className="text-[oklch(0.58_0.22_25)]">Sortie</span>;
                  } else {
                    return <span className="text-[oklch(0.62_0.14_35)]">Transfert</span>;
                  }
                },
              },
            ]}
            initialPageSize={50}
            emptyMessage="Aucun mouvement pour cette période"
          />
        </CardContent>
      </Card>
    </div>
  );
}
