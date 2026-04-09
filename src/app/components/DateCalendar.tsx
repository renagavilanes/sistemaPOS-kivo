import { DayPicker } from 'react-day-picker';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import '../../styles/calendar.css';

interface DateCalendarProps {
  mode: 'single' | 'range';
  selected?: Date | { from?: Date; to?: Date };
  onSelect: (date: Date | { from?: Date; to?: Date } | undefined) => void;
  weekMode?: boolean;
}

export function DateCalendar({ mode, selected, onSelect, weekMode }: DateCalendarProps) {
  const handleDayClick = (date: Date | undefined) => {
    if (!date) return;

    if (weekMode && mode === 'range') {
      // Select entire week (Monday to Sunday)
      const weekStart = startOfWeek(date, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
      onSelect({ from: weekStart, to: weekEnd });
    } else if (mode === 'single') {
      onSelect(date);
    }
  };

  return (
    <div className="date-calendar-wrapper">
      <DayPicker
        mode={mode}
        selected={selected}
        onDayClick={weekMode ? handleDayClick : undefined}
        onSelect={weekMode ? undefined : (onSelect as any)}
        locale={es}
        weekStartsOn={1}
        className="rounded-lg"
        classNames={{
          months: 'flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0',
          month: 'space-y-4',
          caption: 'flex justify-center pt-1 relative items-center',
          caption_label: 'text-base font-semibold',
          nav: 'space-x-1 flex items-center',
          nav_button: 'h-8 w-8 bg-transparent p-0 opacity-50 hover:opacity-100 inline-flex items-center justify-center rounded-md',
          nav_button_previous: 'absolute left-1',
          nav_button_next: 'absolute right-1',
          table: 'w-full border-collapse space-y-1',
          head_row: 'flex',
          head_cell: 'text-gray-600 rounded-md w-10 font-semibold text-sm uppercase',
          row: 'flex w-full mt-2',
          cell: 'text-center text-sm p-0 relative focus-within:relative focus-within:z-20',
          day: 'h-10 w-10 p-0 font-normal rounded-md hover:bg-gray-100 inline-flex items-center justify-center',
          day_selected: 'bg-teal-500 text-white hover:bg-teal-600 hover:text-white focus:bg-teal-500 focus:text-white font-semibold',
          day_today: 'bg-gray-100 text-gray-900 font-medium',
          day_outside: 'text-gray-400 opacity-50',
          day_disabled: 'text-gray-400 opacity-50',
          day_range_middle: 'bg-teal-100 text-gray-900',
          day_hidden: 'invisible',
        }}
      />
    </div>
  );
}