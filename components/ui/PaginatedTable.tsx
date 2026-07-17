'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Column<T> {
  key: string;
  header: string;
  className?: string;
  render?: (row: T, index: number) => React.ReactNode;
}

interface PaginatedTableProps<T> {
  data: T[];
  columns: Column<T>[];
  /** Custom React key for each row. Falls back to row.id then the row index. */
  getRowKey?: (row: T, index: number) => string;
  initialPageSize?: number;
  pageSizeOptions?: number[];
  emptyMessage?: string;
}

export function PaginatedTable<T>({
  data,
  columns,
  getRowKey,
  initialPageSize = 50,
  pageSizeOptions = [25, 50, 100, 200],
  emptyMessage = 'Aucune donnée disponible',
}: PaginatedTableProps<T>) {
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  const currentData = useMemo(
    () => data.slice(startIndex, endIndex),
    [data, startIndex, endIndex]
  );

  const resolveRowKey = (row: T, index: number) => {
    if (getRowKey) return getRowKey(row, index);
    const maybeId = (row as any)?.id;
    return maybeId != null ? String(maybeId) : String(index);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1);
  };

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  };

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="[&_tr]:border-b [&_tr]:bg-muted/40">
              <TableRow className="hover:bg-transparent">
                {columns.map((column) => (
                  <TableHead key={column.key} className={column.className}>
                    {column.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentData.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={columns.length} className="p-0">
                    <EmptyState title={emptyMessage} />
                  </TableCell>
                </TableRow>
              ) : (
                currentData.map((row, rowIndex) => (
                  <TableRow key={resolveRowKey(row, rowIndex)}>
                    {columns.map((column) => (
                      <TableCell key={column.key} className={column.className}>
                        {column.render ? column.render(row, rowIndex) : (row as any)[column.key]}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {data.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="hidden sm:inline">Lignes&nbsp;:</span>
            <div className="flex gap-1">
              {pageSizeOptions.map((size) => (
                <Button
                  key={size}
                  variant={pageSize === size ? 'default' : 'outline'}
                  size="xs"
                  onClick={() => handlePageSizeChange(size)}
                >
                  {size}
                </Button>
              ))}
            </div>
            <span className="tabular-nums">
              {startIndex + 1}–{Math.min(endIndex, data.length)} sur {data.length}
            </span>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handlePreviousPage} disabled={safePage === 1}>
                Précédent
              </Button>
              <span className="text-sm tabular-nums text-muted-foreground">
                Page {safePage} / {totalPages}
              </span>
              <Button variant="outline" size="sm" onClick={handleNextPage} disabled={safePage === totalPages}>
                Suivant
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
