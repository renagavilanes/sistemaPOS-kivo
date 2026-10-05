import { DayPicker } from 'react-day-picker';
import { startOfWeek, endOfWeek } from 'date-fns';
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
          table: 'w-full border-collapse',
          head_row: 'rdp-head_row flex w-full',
          head_cell: 'rdp-head_cell text-gray-600 font-semibold text-sm uppercase',
          row: 'rdp-row flex w-full mt-2',
          cell: 'rdp-cell relative p-0',
          day: 'rdp-day p-0 font-normal inline-flex items-center justify-center',
          day_selected: 'rdp-day_selected text-white font-semibold',
          day_today: 'rdp-day_today font-medium',
          day_outside: 'rdp-day_outside text-gray-400',
          day_disabled: 'rdp-day_disabled text-gray-400 opacity-50',
          day_range_start: 'rdp-day_range_start',
          day_range_end: 'rdp-day_range_end',
          day_range_middle: 'rdp-day_range_middle',
          day_hidden: 'rdp-day_hidden invisible',
        }}
      />
    </div>
  );
}