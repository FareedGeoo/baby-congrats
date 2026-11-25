import { LanguageSwitcher } from '../components/LanguageSwitcher.jsx';
import {
  PaperCard,
  PaperClip,
  PolaroidFrame,
  ScrapbookIcon,
  ScrapbookLabel,
  ScrapbookSticker,
  WashiTape,
} from '../components/ScrapbookComponents.jsx';
import { useI18n } from '../i18n/index.js';
import { en } from '../i18n/en.js';
import { ar } from '../i18n/ar.js';
import { themeList } from '../themes/index.js';

const dictionaries = { en, ar };

function LanguageSpecimen({ language, theme }) {
  const copy = dictionaries[language];
  const direction = language === 'ar' ? 'rtl' : 'ltr';

  return (
    <article
      className="language-specimen"
      lang={language}
      dir={direction}
      aria-label={copy.preview[language === 'ar' ? 'arabicSample' : 'englishSample']}
    >
      <p className="specimen-language">{language === 'ar' ? copy.arabic : copy.english}</p>
      <PaperCard className="specimen-paper">
        <WashiTape />
        <PaperClip />
        <ScrapbookLabel className="specimen-label">{copy.sample.label}</ScrapbookLabel>
        <h3 className="specimen-heading">{copy.sample.headline}</h3>
        <div className="specimen-content">
          <PolaroidFrame caption={copy.sample.caption} tilt={theme.id === 'royal' ? '1deg' : '-2deg'}>
            <ScrapbookIcon name={theme.id === 'boy' ? 'cloud' : theme.id === 'girl' ? 'heart' : 'crown'} size={46} />
          </PolaroidFrame>
          <div className="specimen-note">
            <PhotoNoteIcons theme={theme.id} />
            <p className="scrapbook-handwritten">{copy.sample.message}</p>
            <p className="specimen-signature scrapbook-handwritten">{copy.sample.signature}</p>
          </div>
        </div>
        <ScrapbookSticker
          icon={theme.id === 'girl' ? 'bow' : theme.id === 'royal' ? 'crown' : 'star'}
          className="specimen-sticker"
        >
          {copy.sample.sticker}
        </ScrapbookSticker>
      </PaperCard>
    </article>
  );
}

function PhotoNoteIcons({ theme }) {
  const iconNames = theme === 'boy'
    ? ['cloud', 'star']
    : theme === 'girl'
      ? ['heart', 'bow']
      : ['crown', 'star'];

  return (
    <div className="specimen-doodles" aria-hidden="true">
      {iconNames.map((name) => <ScrapbookIcon key={name} name={name} size={23} />)}
    </div>
  );
}

export function DesignPreview() {
  const { t } = useI18n();

  return (
    <main id="main" className="design-preview">
      <div className="preview-shell">
        <header className="preview-header">
          <div>
            <p className="preview-kicker">{t('preview.kicker')}</p>
            <h1 className="preview-title">{t('preview.title')}</h1>
            <p className="preview-description">{t('preview.description')}</p>
          </div>
          <LanguageSwitcher />
        </header>

        <div className="theme-preview-list">
          {themeList.map((theme) => (
            <section
              key={theme.id}
              className={`theme-preview theme-preview--${theme.id}`}
              data-theme={theme.id}
              style={theme.cssVariables}
              aria-labelledby={`theme-${theme.id}`}
            >
              <header className="theme-preview-heading">
                <div>
                  <p className="theme-preview-index">{t(`themeTypes.${theme.id}`)}</p>
                  <h2 id={`theme-${theme.id}`}>{t(`themeNames.${theme.id}`)}</h2>
                </div>
                <span className="theme-preview-colors" aria-label={t('preview.themeColor', { color: theme.themeColor })}>
                  <i />
                  <i />
                  <i />
                </span>
              </header>
              <div className="language-specimen-grid">
                <LanguageSpecimen language="en" theme={theme} />
                <LanguageSpecimen language="ar" theme={theme} />
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
