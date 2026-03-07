'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { toast } from 'sonner';

type ExportFormat = 'excel' | 'csv';

interface ExportButtonProps {
  onExport: (format: ExportFormat) => void | Promise<void>;
  disabled?: boolean;
  loading?: boolean;
  label?: string;
}

export function ExportButton({
  onExport,
  disabled = false,
  loading = false,
  label = 'Exporter',
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (format: ExportFormat) => {
    if (isExporting || disabled) return;

    setIsExporting(true);
    try {
      await onExport(format);
      toast.success(`Export ${format === 'excel' ? 'Excel' : 'CSV'} réussi`);
    } catch (error) {
      console.error('Erreur lors de l\'export:', error);
      toast.error('Erreur lors de l\'export');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={disabled || loading || isExporting}>
          <Download className="h-4 w-4 mr-2" />
          {isExporting ? 'Export...' : label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => handleExport('excel')}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          <div className="flex flex-col">
            <span>Excel (.xlsx)</span>
            <span className="text-xs text-muted-foreground">Format avec mise en forme</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('csv')}>
          <FileText className="h-4 w-4 mr-2" />
          <div className="flex flex-col">
            <span>CSV</span>
            <span className="text-xs text-muted-foreground">Format compatible</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
