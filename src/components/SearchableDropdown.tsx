import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';

interface SearchableDropdownProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  loading?: boolean;
  name?: string;
}

export default function SearchableDropdown({
  options,
  value,
  onChange,
  placeholder = 'Search...',
  disabled = false,
  required = false,
  loading = false,
  name,
}: SearchableDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = searchTerm
    ? options.filter((opt) =>
        opt.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : options;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (option: string) => {
    onChange(option);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearchTerm('');
  };

  const handleOpen = () => {
    if (disabled) return;
    setIsOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <div ref={containerRef} className="relative">
      {name && (
        <input
          type="text"
          name={name}
          value={value}
          required={required}
          onChange={() => {}}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />
      )}

      <div
        onClick={handleOpen}
        className={`w-full px-4 py-2 border border-gray-300 rounded-lg flex items-center justify-between cursor-pointer transition-colors ${
          disabled
            ? 'bg-gray-100 cursor-not-allowed'
            : 'bg-white hover:border-gray-400'
        } ${isOpen ? 'ring-2 ring-[#0072BC] border-transparent' : ''}`}
      >
        <span className={value ? 'text-gray-900' : 'text-gray-500'}>
          {value || placeholder}
        </span>
        <div className="flex items-center gap-1">
          {value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 hover:bg-gray-100 rounded"
            >
              <X size={14} className="text-gray-400" />
            </button>
          )}
          <ChevronDown
            size={16}
            className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Type to search..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-[#0072BC] focus:border-transparent outline-none"
              />
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto">
            {loading ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500">
                Loading jobs...
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500">
                {searchTerm ? 'No matching projects found' : 'No projects available'}
              </div>
            ) : (
              filtered.map((option, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleSelect(option)}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                    option === value
                      ? 'bg-[#0072BC] text-white'
                      : 'text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {option}
                </button>
              ))
            )}
          </div>

          {!loading && filtered.length > 0 && (
            <div className="px-3 py-2 border-t border-gray-100 bg-gray-50">
              <span className="text-xs text-gray-500">
                {filtered.length} of {options.length} projects
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
