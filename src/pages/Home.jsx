import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, Loader2, Sparkles } from 'lucide-react';
import { Header } from '../components/Header.jsx';
import { Hero } from '../components/Hero.jsx';
import { KeepsakeCard } from '../components/KeepsakeCard.jsx';
import { GuestbookForm } from '../components/GuestbookForm.jsx';
import { MessageGrid } from '../components/MessageGrid.jsx';
import { Lightbox } from '../components/Lightbox.jsx';
import { PaperCard, ScrapbookIcon, ScrapbookLabel, WashiTape } from '../components/ScrapbookComponents.jsx';
import { useMessages } from '../hooks/useMessages.js';
import { useSiteSettings } from '../hooks/useSiteSettings.js';
import { useTheme } from '../hooks/useTheme.js';
import { useI18n } from '../i18n/index.js';

const RECIPIENT_FILTERS = ['all', 'baby', 'parents'];

export function Home() {
  const { language, t } = useI18n();
  const { settings, loading: settingsLoading, usingFallback } = useSiteSettings();
  const babyName = settings.baby_name || t('hero.defaultBabyName');
  const { theme, toggleTheme, mounted } = useTheme({
    preferredTheme: settings.theme,
    allowVisitorThemeChange: settings.allow_visitor_theme_change,
    ready: !settingsLoading,
  });
  const { messages, loading, error, refetch } = useMessages({ onlyApproved: true });
  const [recipientFilter, setRecipientFilter] = useState('all');
  const [activePhotoId, setActivePhotoId] = useState(null);

  const visibleMessages = useMemo(() => messages
    .filter((message) => recipientFilter === 'all' || message.recipient_type === recipientFilter)
    .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned))
      || new Date(b.created_at) - new Date(a.created_at)), [messages, recipientFilter]);

  const galleryPhotos = useMemo(() => [
    ...(settings.baby_photo_url
      ? [{
        id: 'featured',
        photo_url: settings.baby_photo_url,
        alt: t('hero.welcomePhoto', { name: babyName }),
        name: babyName,
        caption: settings.baby_name,
      }]
      : []),
    ...visibleMessages
      .filter((message) => message.photo_url)
      .map((message) => ({
        id: message.id,
        photo_url: message.photo_url,
        alt: t('memories.photoAlt', { name: message.name }),
        name: message.name,
        message: message.message,
      })),
  ], [babyName, settings.baby_photo_url, t, visibleMessages]);

  const activePhotoIndex = galleryPhotos.findIndex((photo) => photo.id === activePhotoId);
  const activePhoto = activePhotoIndex >= 0 ? galleryPhotos[activePhotoIndex] : null;

  useEffect(() => {
    if (activePhotoId && activePhotoIndex < 0) setActivePhotoId(null);
  }, [activePhotoId, activePhotoIndex]);

  const openFeaturedPhoto = useCallback(() => setActivePhotoId('featured'), []);
  const openMessagePhoto = useCallback((message) => setActivePhotoId(message.id), []);
  const closeLightbox = useCallback(() => setActivePhotoId(null), []);
  const showNextPhoto = useCallback(() => {
    if (galleryPhotos.length < 2) return;
    setActivePhotoId((currentId) => {
      const currentIndex = galleryPhotos.findIndex((photo) => photo.id === currentId);
      return currentIndex < 0
        ? null
        : galleryPhotos[(currentIndex + 1) % galleryPhotos.length].id;
    });
  }, [galleryPhotos]);
  const showPreviousPhoto = useCallback(() => {
    if (galleryPhotos.length < 2) return;
    setActivePhotoId((currentId) => {
      const currentIndex = galleryPhotos.findIndex((photo) => photo.id === currentId);
      return currentIndex < 0
        ? null
        : galleryPhotos[(currentIndex - 1 + galleryPhotos.length) % galleryPhotos.length].id;
    });
  }, [galleryPhotos]);

  if (settingsLoading || !mounted) {
    return (
      <main id="main" className="home-loading" aria-busy="true">
        <Loader2 className="home-loading-icon" aria-hidden="true" />
        <p>{t('home.loading')}</p>
      </main>
    );
  }

  return (
    <div className="home-page theme-bg theme-text" data-theme={theme}>
      <Header
        theme={theme}
        babyName={babyName}
        allowThemeChange={settings.allow_visitor_theme_change}
        toggleTheme={toggleTheme}
      />
      {usingFallback && (
        <p className="settings-fallback-notice" role="status" aria-live="polite">
          {t('settings.fallbackNotice')}
        </p>
      )}
      <main id="main" tabIndex={-1}>
        <Hero
          settings={settings}
          theme={theme}
          onOpenFeaturedPhoto={openFeaturedPhoto}
        />
        <KeepsakeCard settings={settings} />

        <section id="guestbook" className="guestbook-section" aria-labelledby="guestbook-section-title">
          <div className="guestbook-intro">
            <ScrapbookLabel>{t('guestbook.sectionLabel')}</ScrapbookLabel>
            <h2 id="guestbook-section-title">{t('guestbook.invitationTitle', { name: babyName })}</h2>
            <p>{t('guestbook.invitationText')}</p>
            <span className="guestbook-arrow" aria-hidden="true"><ArrowDown size={25} /></span>
          </div>
          <GuestbookForm guestbookOpen={settings.guestbook_open} />
        </section>

        <section id="memories" className="memories-section" aria-labelledby="memories-title">
          <div className="memories-heading">
            <div>
              <p className="memories-eyebrow">{t('memories.eyebrow')}</p>
              <h2 id="memories-title">{t('memories.title')}</h2>
              <p className="memories-description">{t('memories.description')}</p>
            </div>
            <ScrapbookIcon name={theme === 'girl' ? 'heart' : theme === 'royal' ? 'crown' : 'star'} size={42} />
          </div>

          <div className="memory-filters" role="group" aria-label={t('memories.filterLabel')}>
            {RECIPIENT_FILTERS.map((filter) => (
              <button
                key={filter}
                type="button"
                aria-pressed={recipientFilter === filter}
                onClick={() => setRecipientFilter(filter)}
              >
                {t(`memories.${filter}`)}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="memory-wall-status" role="status" aria-live="polite">
              <Loader2 className="home-loading-icon" aria-hidden="true" />
              <p>{t('memories.loading')}</p>
            </div>
          ) : error ? (
            <PaperCard className="memory-wall-status memory-wall-error" role="alert">
              <p>{t('memories.loadError')}</p>
              <button type="button" className="btn-outline" onClick={refetch}>{t('memories.retry')}</button>
            </PaperCard>
          ) : visibleMessages.length > 0 ? (
            <MessageGrid messages={visibleMessages} onOpenPhoto={openMessagePhoto} />
          ) : (
            <PaperCard className="memory-empty-state">
              <WashiTape />
              <span className="memory-empty-icon"><Sparkles size={28} aria-hidden="true" /></span>
              <ScrapbookLabel>{t('memories.emptyLabel')}</ScrapbookLabel>
              <h3>{messages.length === 0 ? t('memories.emptyTitle') : t('memories.emptyFilter')}</h3>
              <p>{messages.length === 0 ? t('memories.emptyText') : t('memories.emptyFilterText')}</p>
              {settings.guestbook_open
                ? <a className="btn-primary" href="#guestbook">{t('memories.leaveFirst')}</a>
                : <p>{t('memories.guestbookClosed')}</p>}
            </PaperCard>
          )}
        </section>
      </main>

      <footer className="home-footer">
        <ScrapbookIcon name="heart" size={18} />
        <span>{t('footer.message', { name: babyName })}</span>
      </footer>

      <Lightbox
        isOpen={Boolean(activePhoto)}
        photo={activePhoto}
        photoCount={galleryPhotos.length}
        onClose={closeLightbox}
        onNext={showNextPhoto}
        onPrevious={showPreviousPhoto}
      />
    </div>
  );
}
