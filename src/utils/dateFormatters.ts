export const formatDateToMMDDYYYY = (date: Date | string | null): string => {
  if (!date) return '';

  const d = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(d.getTime())) return '';

  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const year = d.getFullYear();

  return `${month}/${day}/${year}`;
};

export const convertDateInputToMMDDYYYY = (dateString: string): string => {
  if (!dateString) return '';

  const parts = dateString.split('-');
  if (parts.length !== 3) return dateString;

  const [year, month, day] = parts;
  return `${month}/${day}/${year}`;
};

export const convertMMDDYYYYToDateInput = (dateString: string): string => {
  if (!dateString) return '';

  const parts = dateString.split('/');
  if (parts.length !== 3) return dateString;

  const [month, day, year] = parts;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

export const getCurrentDateInMMDDYYYY = (): string => {
  return formatDateToMMDDYYYY(new Date());
};
