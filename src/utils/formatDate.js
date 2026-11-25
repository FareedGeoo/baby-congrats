export function formatDate(dateString, language = 'en') {
  return new Intl.DateTimeFormat(language, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(dateString));
}

export function formatRelativeDate(dateString, language, t) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return t('admin.today');
  if (diffDays === 1) return t('admin.yesterday');
  if (diffDays < 7) {
    return new Intl.RelativeTimeFormat(language, { numeric: 'auto' }).format(-diffDays, 'day');
  }
  return formatDate(dateString, language);
}