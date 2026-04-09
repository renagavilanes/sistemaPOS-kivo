import { Button } from './ui/button';

interface YearPickerProps {
  selectedYear: number;
  onYearChange: (year: number) => void;
}

export function YearPicker({ selectedYear, onYearChange }: YearPickerProps) {
  const currentYear = 2026;
  const years = Array.from({ length: 10 }, (_, i) => currentYear - i);

  return (
    <div className="p-4">
      <div className="grid grid-cols-2 gap-2">
        {years.map((year) => (
          <Button
            key={year}
            variant={selectedYear === year ? 'default' : 'outline'}
            onClick={() => onYearChange(year)}
            className={`h-12 ${selectedYear === year ? 'bg-teal-500 text-white hover:bg-teal-600' : ''}`}
          >
            {year}
          </Button>
        ))}
      </div>
    </div>
  );
}