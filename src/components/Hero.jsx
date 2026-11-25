import { useState } from 'react';
import {
  PaperCard,
  PaperClip,
  PolaroidFrame,
  ScrapbookIcon,
  ScrapbookSticker,
  WashiTape,
} from './ScrapbookComponents.jsx';
import { useI18n } from '../i18n/index.js';
import { formatSiteDate } from '../utils/formatSiteValue.js';

export function Hero({ settings, theme, onOpenFeaturedPhoto }) {
  const { language, t } = useI18n();
  const [photoFailed, setPhotoFailed] = useState(false);
  const babyName = settings.baby_name || t('hero.defaultBabyName');
  const welcomeTitle = language === 'ar'
    ? settings.welcome_title_ar
    : settings.welcome_title_en;
  const welcomeMessage = language === 'ar'
    ? settings.welcome_message_ar
    : settings.welcome_message_en;
  const photoAlt = t('hero.welcomePhoto', { name: babyName });
  const birthDate = formatSiteDate(settings.birth_date, language);

  return (
    <section className={`home-hero home-hero--${theme}`} aria-labelledby="welcome-title">
      <div className="home-hero-inner">
        <div className="home-hero-copy">
          <div className="hero-date-line">
            <ScrapbookIcon name={theme === 'girl' ? 'heart' : theme === 'royal' ? 'crown' : 'cloud'} size={19} />
            {birthDate && <span>{t('hero.born', { date: birthDate })}</span>}
          </div>
          <h1 id="welcome-title" className="home-hero-name">{babyName}</h1>
          <p className="home-hero-welcome">{welcomeTitle || t('hero.defaultTitle')}</p>
          <p className="home-hero-message">{welcomeMessage || t('hero.defaultMessage')}</p>
          <div className="home-hero-actions">
            <a className="btn-primary" href="#memories">{t('hero.exploreMemories')}</a>
            <a className="hero-secondary-link" href="#guestbook">{t('hero.leaveWish')}</a>
          </div>
        </div>

        <div className="home-hero-art">
          <PaperCard className="hero-photo-note">
            <WashiTape />
            <ScrapbookSticker icon={theme === 'girl' ? 'bow' : theme === 'royal' ? 'crown' : 'star'}>
              {t('hero.leaveWish')}
            </ScrapbookSticker>
          </PaperCard>
          <div className="hero-polaroid-wrap">
            <PaperClip />
            <PolaroidFrame
              src={settings.baby_photo_url && !photoFailed ? settings.baby_photo_url : null}
              alt={photoAlt}
              caption={babyName}
              tilt={theme === 'royal' ? '1deg' : theme === 'girl' ? '2deg' : '-2deg'}
              loading="eager"
              onClick={settings.baby_photo_url && !photoFailed ? onOpenFeaturedPhoto : undefined}
              buttonLabel={photoAlt}
              onError={() => setPhotoFailed(true)}
            >
              <span className="hero-photo-placeholder">
                <ScrapbookIcon name={theme === 'girl' ? 'heart' : theme === 'royal' ? 'crown' : 'cloud'} size={50} />
                <span>{photoFailed ? t('hero.photoUnavailable') : babyName}</span>
              </span>
            </PolaroidFrame>
          </div>
        </div>
      </div>
    </section>
  );
}