function getDateParts(value) {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return null;
  return { year, month, day };
}

export function formatSiteDate(value, language) {
  if (!value) return null;
  const parts = getDateParts(value);
  if (!parts) return value;

  return new Intl.DateTimeFormat(language, { dateStyle: 'long' })
    .format(new Date(parts.year, parts.month - 1, parts.day));
}

export function formatSiteTime(value, language) {
  if (!value) return null;
  const [hours, minutes] = value.split(':').map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return value;

  return new Intl.DateTimeFormat(language, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(2000, 0, 1, hours, minutes));
}
