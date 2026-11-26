/** Shared date formatting for the catalogue visual QA workspace. */
export function formatVisualQaDate(value) {
  if (!value) return 'an unknown time';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'an unknown time';
  return date.toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
