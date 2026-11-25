import { useI18n } from '../i18n/index.js';

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useI18n();

  return (
    <div className="language-switcher" role="group" aria-label={t('languageLabel')}>
      <button
        type="button"
        lang="en"
        aria-pressed={language === 'en'}
        onClick={() => setLanguage('en')}
      >
        {t('english')}
      </button>
      <button
        type="button"
        lang="ar"
        aria-pressed={language === 'ar'}
        onClick={() => setLanguage('ar')}
      >
        {t('arabic')}
      </button>
    </div>
  );
}
