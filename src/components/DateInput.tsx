import { useState, useEffect, useRef } from 'react';
import { Calendar } from 'lucide-react';

interface DateInputProps {
  name: string;
  value: string;
  onChange: (name: string, value: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export default function DateInput({
  name,
  value,
  onChange,
  required = false,
  disabled = false,
  className = '',
}: DateInputProps) {
  const [displayValue, setDisplayValue] = useState('');
  const [error, setError] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMonth, setPickerMonth] = useState(new Date().getMonth());
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDisplayValue(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatInput = (input: string): string => {
    const cleaned = input.replace(/\D/g, '');

    if (cleaned.length === 0) return '';
    if (cleaned.length <= 2) return cleaned;
    if (cleaned.length <= 4) return `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
    return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}/${cleaned.slice(4, 8)}`;
  };

  const validateComplete = (formatted: string): string | null => {
    if (formatted.length !== 10) return null;

    const parts = formatted.split('/');
    const month = parseInt(parts[0], 10);
    const day = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);

    if (month < 1 || month > 12) {
      return 'Invalid month (01-12)';
    }

    if (day < 1 || day > 31) {
      return 'Invalid day (01-31)';
    }

    if (year < 1900 || year > 2100) {
      return 'Year must be between 1900 and 2100';
    }

    const maxDays = new Date(year, month, 0).getDate();
    if (day > maxDays) {
      return `Invalid day for ${parts[0]}/${parts[2]} (max: ${maxDays})`;
    }

    return null;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    const formatted = formatInput(input);

    setDisplayValue(formatted);
    setError('');

    if (formatted.length === 10) {
      const validationError = validateComplete(formatted);
      if (validationError) {
        setError(validationError);
      } else {
        onChange(name, formatted);
      }
    } else if (formatted.length === 0) {
      onChange(name, '');
    }
  };

  const handleBlur = () => {
    if (displayValue.length > 0 && displayValue.length < 10) {
      setError('Please enter a complete date (MM/DD/YYYY)');
    } else if (displayValue.length === 10) {
      const validationError = validateComplete(displayValue);
      if (validationError) {
        setError(validationError);
      }
    }
  };

  const handleDateSelect = (day: number) => {
    const month = String(pickerMonth + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const formatted = `${month}/${dayStr}/${pickerYear}`;

    setDisplayValue(formatted);
    setError('');
    onChange(name, formatted);
    setShowPicker(false);
  };

  const togglePicker = () => {
    if (disabled) return;

    if (!showPicker && displayValue.length === 10) {
      const parts = displayValue.split('/');
      const month = parseInt(parts[0], 10) - 1;
      const year = parseInt(parts[2], 10);
      if (month >= 0 && month <= 11 && year >= 1900 && year <= 2100) {
        setPickerMonth(month);
        setPickerYear(year);
      }
    }

    setShowPicker(!showPicker);
  };

  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (month: number, year: number) => {
    return new Date(year, month, 1).getDay();
  };

  const prevMonth = () => {
    if (pickerMonth === 0) {
      setPickerMonth(11);
      setPickerYear(pickerYear - 1);
    } else {
      setPickerMonth(pickerMonth - 1);
    }
  };

  const nextMonth = () => {
    if (pickerMonth === 11) {
      setPickerMonth(0);
      setPickerYear(pickerYear + 1);
    } else {
      setPickerMonth(pickerMonth + 1);
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(pickerMonth, pickerYear);
    const firstDay = getFirstDayOfMonth(pickerMonth, pickerYear);
    const days = [];

    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="w-8 h-8" />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const isSelected = displayValue.length === 10 &&
        parseInt(displayValue.split('/')[0], 10) === pickerMonth + 1 &&
        parseInt(displayValue.split('/')[1], 10) === day &&
        parseInt(displayValue.split('/')[2], 10) === pickerYear;

      days.push(
        <button
          key={day}
          type="button"
          onClick={() => handleDateSelect(day)}
          className={`w-8 h-8 rounded-full text-sm flex items-center justify-center transition-colors
            ${isSelected
              ? 'bg-[#0072BC] text-white'
              : 'hover:bg-gray-100 text-gray-700'
            }`}
        >
          {day}
        </button>
      );
    }

    return days;
  };

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <input
          type="text"
          name={name}
          value={displayValue}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="MM/DD/YYYY"
          maxLength={10}
          required={required}
          disabled={disabled}
          className={`w-full px-4 py-2 pr-10 border ${
            error ? 'border-red-500' : 'border-gray-300'
          } rounded-lg focus:ring-2 focus:ring-[#0072BC] focus:border-transparent disabled:bg-gray-100 ${className}`}
        />
        <button
          type="button"
          onClick={togglePicker}
          disabled={disabled}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded disabled:cursor-not-allowed disabled:hover:bg-transparent"
        >
          <Calendar size={18} className="text-gray-400" />
        </button>
      </div>

      {showPicker && (
        <div className="absolute z-50 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-[280px]">
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex gap-2">
              <select
                value={pickerMonth}
                onChange={(e) => setPickerMonth(parseInt(e.target.value))}
                className="text-sm font-medium border rounded px-2 py-1"
              >
                {monthNames.map((m, i) => (
                  <option key={m} value={i}>{m}</option>
                ))}
              </select>
              <select
                value={pickerYear}
                onChange={(e) => setPickerYear(parseInt(e.target.value))}
                className="text-sm font-medium border rounded px-2 py-1"
              >
                {Array.from({ length: 201 }, (_, i) => 1900 + i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
              <div key={d} className="w-8 h-8 flex items-center justify-center text-xs font-medium text-gray-500">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {renderCalendar()}
          </div>

          <div className="mt-3 pt-2 border-t flex justify-end">
            <button
              type="button"
              onClick={() => {
                const today = new Date();
                setPickerMonth(today.getMonth());
                setPickerYear(today.getFullYear());
                handleDateSelect(today.getDate());
              }}
              className="text-sm text-[#0072BC] hover:underline"
            >
              Today
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-500 mt-1">{error}</p>
      )}
    </div>
  );
}
