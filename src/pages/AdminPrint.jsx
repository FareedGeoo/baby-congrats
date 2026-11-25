import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Loader2, Printer } from 'lucide-react';
import { Link } from 'react-router-dom';
import { LanguageSwitcher } from '../components/LanguageSwitcher.jsx';
import { PaperCard, PolaroidFrame, ScrapbookIcon } from '../components/ScrapbookComponents.jsx';
import { supabase } from '../lib/supabase.js';
import { useI18n } from '../i18n/index.js';
import { themes } from '../themes/index.js';
import { fetchAllMessages } from '../utils/fetchAllMessages.js';
import { SITE_SETTINGS_COLUMNS } from '../utils/siteSettings.js';

function formatPrintDate(dateValue, language, fallback) {
  const date = new Date(dateValue);
  if (!dateValue || Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat(language, {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(date);
}

function PrintPhoto({ photoUrl, alt, caption, t }) {
  const [failed, setFailed] = useState(false);

  if (!photoUrl) return null;
  if (failed) {
    return <p className="admin-print-photo-error">{t('admin.printPhotoUnavailable')}</p>;
  }

  return (
    <PolaroidFrame
      src={photoUrl}
      alt={alt}
      caption={caption}
      loading="eager"
      onError={() => setFailed(true)}
    >
      <ScrapbookIcon name="cloud" size={38} />
    </PolaroidFrame>
  );
}

export function AdminPrint() {
  const { language, t } = useI18n();
  const [status, setStatus] = useState('checking');
  const [settings, setSettings] = useState(null);
  const [messages, setMessages] = useState([]);
  const [includePending, setIncludePending] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let active = true;
    let sessionRevoked = false;
    let authorizedUserId = '';
    setStatus('checking');
    setSettings(null);
    setMessages([]);

    const { data: authListener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (
        event === 'SIGNED_OUT'
        || event === 'USER_DELETED'
        || (authorizedUserId && nextSession?.user.id !== authorizedUserId)
      ) {
        sessionRevoked = true;
        setSettings(null);
        setMessages([]);
        setStatus('unauthorized');
      }
    });

    async function loadPrintData() {
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!sessionData.session) {
          if (active) setStatus('unauthorized');
          return;
        }
        authorizedUserId = sessionData.session.user.id;

        const { data: isAdmin, error: adminError } = await supabase.rpc('is_admin');
        if (adminError) throw adminError;
        if (!isAdmin) {
          if (active) setStatus('unauthorized');
          return;
        }
        if (!active || sessionRevoked) return;

        setStatus('loading');
        const [settingsResult, allMessages] = await Promise.all([
          supabase
            .from('site_settings')
            .select(SITE_SETTINGS_COLUMNS)
            .eq('id', 1)
            .maybeSingle(),
          fetchAllMessages({ ascending: true }),
        ]);
        if (settingsResult.error) throw settingsResult.error;
        if (!settingsResult.data) throw new Error('The site settings row is missing.');
        if (!active || sessionRevoked) return;

        setSettings(settingsResult.data);
        setMessages(allMessages);
        setStatus('ready');
      } catch (error) {
        console.error('Could not load the admin memory book for printing.', error);
        if (active && !sessionRevoked) setStatus('error');
      }
    }

    loadPrintData();
    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, [retryCount]);

  const visibleMessages = useMemo(() => messages
    .filter((message) => includePending || Boolean(message.approved))
    .sort((first, second) => new Date(first.created_at) - new Date(second.created_at)),
  [includePending, messages]);

  if (status !== 'ready') {
    const isBusy = status === 'checking' || status === 'loading';
    return (
      <main id="main" className="admin-access theme-bg theme-text">
        <div className="admin-access-language"><LanguageSwitcher /></div>
        <PaperCard className="admin-access-card">
          {isBusy ? (
            <div className="admin-print-state" role="status" aria-live="polite">
              <Loader2 className="admin-access-spinner" aria-hidden="true" />
              <p>{t(status === 'checking' ? 'admin.printChecking' : 'admin.printLoading')}</p>
            </div>
          ) : status === 'unauthorized' ? (
            <>
              <h1>{t('admin.printUnauthorizedTitle')}</h1>
              <p>{t('admin.printUnauthorizedText')}</p>
              <Link className="btn-primary admin-print-access-link" to="/admin">
                {t('admin.printGoToAdmin')}
              </Link>
            </>
          ) : (
            <div role="alert" aria-live="polite">
              <h1>{t('admin.printLoadError')}</h1>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setRetryCount((count) => count + 1)}
              >
                {t('admin.retryLoad')}
              </button>
            </div>
          )}
        </PaperCard>
      </main>
    );
  }

  const babyName = settings.baby_name || t('hero.defaultBabyName');

  return (
    <main
      id="main"
      className="admin-print-page theme-bg theme-text"
      dir={language === 'ar' ? 'rtl' : 'ltr'}
      style={themes[settings.theme]?.cssVariables || themes.boy.cssVariables}
    >
      <div className="admin-print-toolbar">
        <Link className="btn-outline" to="/admin">
          <ArrowLeft size={18} aria-hidden="true" />
          {t('admin.printBackToAdmin')}
        </Link>
        <label className="admin-print-pending-toggle">
          <input
            type="checkbox"
            checked={includePending}
            onChange={(event) => setIncludePending(event.target.checked)}
          />
          <span>{t('admin.printIncludePending')}</span>
        </label>
        <LanguageSwitcher />
        <button type="button" className="btn-primary" onClick={() => window.print()}>
          <Printer size={18} aria-hidden="true" />
          {t('admin.printAction')}
        </button>
      </div>

      <article className="admin-print-document">
        <header className="admin-print-cover">
          <p className="admin-print-kicker">{t('admin.printKicker')}</p>
          <h1>{babyName}</h1>
          <p className="admin-print-subtitle">{t('admin.printSubtitle')}</p>
          <div className="admin-print-featured">
            <PrintPhoto
              photoUrl={settings.baby_photo_url}
              alt={t('hero.welcomePhoto', { name: babyName })}
              caption={babyName}
              t={t}
            />
          </div>
        </header>

        <section className="admin-print-memories" aria-labelledby="admin-print-memories-title">
          <header className="admin-print-section-heading">
            <h2 id="admin-print-memories-title">{t('admin.printMessagesTitle')}</h2>
            <p>{t('admin.printMessagesCount', { count: visibleMessages.length })}</p>
          </header>

          {visibleMessages.length === 0 ? (
            <PaperCard className="admin-print-empty">
              <p>{t('admin.printNoMessages')}</p>
            </PaperCard>
          ) : (
            <div className="admin-print-message-list">
              {visibleMessages.map((message) => {
                const recipient = message.recipient_type === 'parents'
                  ? t('guestbook.parents')
                  : t('guestbook.baby');
                return (
                  <PaperCard
                    className={`admin-print-message${message.photo_url ? ' has-photo' : ''}`}
                    key={message.id}
                  >
                    <div className="admin-print-message-content">
                      <div className="admin-print-message-header">
                        <h3 dir="auto">{message.name}</h3>
                        <span className="admin-print-message-status">
                          {t(message.approved ? 'admin.approved' : 'admin.pending')}
                        </span>
                      </div>
                      <p className="admin-print-message-text" dir="auto">{message.message}</p>
                      <div className="admin-print-message-meta">
                        <span>
                          {t('admin.printRecipient', { recipient })}
                        </span>
                        <time dateTime={message.created_at || undefined}>
                          {formatPrintDate(message.created_at, language, t('admin.dateUnknown'))}
                        </time>
                      </div>
                    </div>
                    {message.photo_url && (
                      <div className="admin-print-message-photo">
                        <PrintPhoto
                          photoUrl={message.photo_url}
                          alt={t('admin.photoAlt', { name: message.name })}
                          caption={message.name}
                          t={t}
                        />
                      </div>
                    )}
                  </PaperCard>
                );
              })}
            </div>
          )}
        </section>
      </article>
    </main>
  );
}
