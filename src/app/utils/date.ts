/**
 * Format date in Spanish format (dd/mm/yyyy)
 * 
 * @param dateString - The date string to format (ISO format or any valid date string)
 * @returns Formatted date string in dd/mm/yyyy format
 */
export function formatDate(dateString: string): string {
  if (!dateString) return '';
  
  // Si es solo fecha (YYYY-MM-DD), añadir T00:00:00 para evitar que JS la
  // interprete como UTC midnight (lo que causa un desfase de -1 día en UTC-)
  const normalized = dateString.length === 10 ? dateString + 'T00:00:00' : dateString;
  const date = new Date(normalized);
  
  // Check if date is valid
  if (isNaN(date.getTime())) return dateString;
  
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  
  return `${day}/${month}/${year}`;
}

/**
 * Format time in HH:mm format
 * 
 * @param timeString - The time string to format
 * @returns Formatted time string
 */
export function formatTime(timeString: string): string {
  if (!timeString) return '';
  return timeString;
}