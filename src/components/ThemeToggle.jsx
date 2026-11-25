import { useI18n } from '../i18n/index.js';
import { ScrapbookIcon } from './ScrapbookComponents.jsx';

const THEME_ORDER = ['boy', 'girl', 'royal'];
const THEME_ICONS = { boy: 'cloud', girl: 'bow', royal: 'crown' };

export function ThemeToggle({ theme, toggleTheme }) {
  const { t } = useI18n();
  const currentIndex = THEME_ORDER.indexOf(theme);
  const nextTheme = THEME_ORDER[(currentIndex + 1) % THEME_ORDER.length];

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={t('themeToggle.switchToTheme', { theme: t(`themeTypes.${nextTheme}`) })}
      className="btn-outline h-11 min-w-11 px-2 sm:px-3 gap-2"
    >
      <ScrapbookIcon name={THEME_ICONS[nextTheme]} size={16} />
      <span className="hidden sm:inline">{t(`themeTypes.${nextTheme}`)}</span>
    </button>
  );
}