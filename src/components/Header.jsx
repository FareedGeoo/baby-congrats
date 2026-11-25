import { Link } from 'react-router-dom';
import { LanguageSwitcher } from './LanguageSwitcher.jsx';
import { ScrapbookIcon } from './ScrapbookComponents.jsx';
import { ThemeToggle } from './ThemeToggle.jsx';
import { useI18n } from '../i18n/index.js';

export function Header({ theme, babyName, allowThemeChange, toggleTheme }) {
  const { t } = useI18n();
  const logo = theme === 'girl' ? 'bow' : theme === 'royal' ? 'crown' : 'cloud';

  return (
    <header className="home-header">
      <div className="home-header-inner">
        <Link to="/" className="home-brand" aria-label={t('nav.brand', { name: babyName })}>
          <span className="home-brand-mark" aria-hidden="true">
            <ScrapbookIcon name={logo} size={24} />
          </span>
          <span className="home-brand-name">{t('nav.brand', { name: babyName })}</span>
        </Link>
        <nav className="home-nav" aria-label={t('nav.primary')}>
          <a href="#main">{t('nav.home')}</a>
          <a href="#memories">{t('nav.memories')}</a>
          <a href="#guestbook">{t('nav.leaveMessage')}</a>
        </nav>
        {allowThemeChange && <ThemeToggle theme={theme} toggleTheme={toggleTheme} />}
        <LanguageSwitcher />
      </div>
    </header>
  );
}