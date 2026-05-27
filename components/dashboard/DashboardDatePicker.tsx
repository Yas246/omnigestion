'use client';

import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

interface DashboardDatePickerProps {
  date: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
}

export function DashboardDatePicker({ date, onDateChange }: DashboardDatePickerProps) {
  const today = new Date();
  const isToday = !date || format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');

  return (
    <div className="flex items-center gap-2">
      {!isToday && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDateChange(undefined)}
          className="text-xs"
        >
          Aujourd&apos;hui
        </Button>
      )}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-sm font-normal"
          >
            <CalendarIcon className="h-4 w-4" />
            {isToday
              ? "Aujourd'hui"
              : format(date!, "d MMMM yyyy", { locale: fr })}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={date}
            onSelect={onDateChange}
            defaultMonth={date || today}
            disabled={(d) => d > today}
            locale={fr}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
