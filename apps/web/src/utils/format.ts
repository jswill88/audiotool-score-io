export function formatProjectDate(value: string | undefined) {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric'
  }).format(date);
}

export function formatDeviceType(value: string | null | undefined) {
  if (!value) return 'Note track';

  return String(value)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([a-z])([0-9])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
