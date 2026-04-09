import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

interface MonthYearPickerProps {
  selectedMonth: number;
  selectedYear: number;
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
}

export function MonthYearPicker({
  selectedMonth,
  selectedYear,
  onMonthChange,
  onYearChange,
}: MonthYearPickerProps) {
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const years = [2026, 2025, 2024, 2023, 2022, 2021];

  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      onMonthChange(11);
      onYearChange(selectedYear - 1);
    } else {
      onMonthChange(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      onMonthChange(0);
      onYearChange(selectedYear + 1);
    } else {
      onMonthChange(selectedMonth + 1);
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Month/Year Header */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={handlePrevMonth}
          className="h-8 w-8 p-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <Select value={`${selectedYear}-${selectedMonth}`} onValueChange={(value) => {
          const [year, month] = value.split('-');
          onYearChange(parseInt(year));
          onMonthChange(parseInt(month));
        }}>
          <SelectTrigger className="w-[180px] border-0 shadow-none font-semibold text-base">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map(year => 
              months.map((month, idx) => (
                <SelectItem key={`${year}-${idx}`} value={`${year}-${idx}`}>
                  {month} {year}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleNextMonth}
          className="h-8 w-8 p-0"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Month Grid */}
      <div className="grid grid-cols-3 gap-2">
        {months.map((month, idx) => (
          <Button
            key={idx}
            variant={selectedMonth === idx ? 'default' : 'outline'}
            onClick={() => onMonthChange(idx)}
            className={`h-12 ${selectedMonth === idx ? 'bg-teal-500 text-white hover:bg-teal-600' : ''}`}
          >
            {month.slice(0, 3)}
          </Button>
        ))}
      </div>
    </div>
  );
}