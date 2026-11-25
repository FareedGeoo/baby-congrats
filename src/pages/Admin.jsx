import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Download,
  Heart,
  Image as ImageIcon,
  ImageOff,
  Loader2,
  LogOut,
  Pin,
  Search,
  Settings as SettingsIcon,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import { LanguageSwitcher } from '../components/LanguageSwitcher.jsx';
import { Lightbox } from '../components/Lightbox.jsx';
import { PaperCard, ScrapbookLabel } from '../components/ScrapbookComponents.jsx';
import { AdminPhotos } from '../components/admin/AdminPhotos.jsx';
import { AdminExports } from '../components/admin/AdminExports.jsx';
import { AdminSettings } from '../components/admin/AdminSettings.jsx';
import { useI18n } from '../i18n/index.js';
import { fetchAllMessages } from '../utils/fetchAllMessages.js';
import { formatRelativeDate } from '../utils/formatDate.js';
import { SITE_SETTINGS_COLUMNS } from '../utils/siteSettings.js';
import { getStoragePath, isMissingStorageObject } from '../utils/storage.js';

const ADMIN_TABS = ['pending', 'approved', 'all', 'photos', 'exports', 'settings'];
const MESSAGE_TABS = ['pending', 'approved', 'all'];
const RECIPIENT_FILTERS = ['all', 'baby', 'parents'];
const PHOTO_BUCKET = 'baby-photos';

function applyRealtimeEvent(messages, payload) {
  if (payload.eventType === 'DELETE') {
    return messages.filter((message) => message.id !== payload.old?.id);
  }

  const updatedMessage = payload.new;
  if (!updatedMessage?.id) return messages;
  const existingIndex = messages.findIndex((message) => message.id === updatedMessage.id);
  if (existingIndex < 0) return [updatedMessage, ...messages];

  return messages.map((message) => (
    message.id === updatedMessage.id ? updatedMessage : message
  ));
}

function StatusBadge({ approved, pinned }) {
  const { t } = useI18n();

  return (
    <div className="admin-badges">
      <span className={`admin-status-badge ${approved ? 'is-approved' : 'is-pending'}`}>
        {approved ? t('admin.approved') : t('admin.pending')}
      </span>
      {pinned && <span className="admin-status-badge is-pinned">{t('admin.pinnedBadge')}</span>}
    </div>
  );
}

function AdminPhoto({ message, onOpen }) {
  const { t } = useI18n();
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => setImageFailed(false), [message.photo_url]);

  if (!message.photo_url) {
    return <span className="admin-no-photo">{t('admin.noPhoto')}</span>;
  }

  return (
    <button
      type="button"
      className="admin-photo-button"
      onClick={onOpen}
      aria-label={t('admin.openPhoto', { name: message.name })}
    >
      {imageFailed ? (
        <span className="admin-photo-fallback">
          <ImageOff size={20} aria-hidden="true" />
          <span>{t('admin.photoUnavailable')}</span>
        </span>
      ) : (
        <img
          src={message.photo_url}
          alt={t('admin.photoAlt', { name: message.name })}
          width="96"
          height="72"
          loading="lazy"
          onError={() => setImageFailed(true)}
        />
      )}
    </button>
  );
}

function MessageActions({ message, busy, onApproval, onPin, onDelete }) {
  const { t } = useI18n();

  return (
    <div className="admin-message-actions">
      <button type="button" className="admin-action-button" onClick={() => onApproval(message)} disabled={busy}>
        <Check size={16} aria-hidden="true" />
        {message.approved ? t('admin.unapproveMessage') : t('admin.approveMessage')}
      </button>
      <button type="button" className="admin-action-button" onClick={() => onPin(message)} disabled={busy}>
        <Pin size={16} aria-hidden="true" />
        {message.pinned ? t('admin.unpinMessage') : t('admin.pinMessage')}
      </button>
      <button type="button" className="admin-action-button is-destructive" onClick={(event) => onDelete(message, event)} disabled={busy}>
        <Trash2 size={16} aria-hidden="true" />
        {t('admin.deleteMessage')}
      </button>
    </div>
  );
}

function OverviewCard({ label, value }) {
  return (
    <PaperCard className="admin-overview-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </PaperCard>
  );
}

function AdminAccessLayout({ children }) {
  return (
    <main id="main" className="admin-access theme-bg theme-text">
      <div className="admin-access-language"><LanguageSwitcher /></div>
      {children}
    </main>
  );
}

export function Admin() {
  const { language, t } = useI18n();
  const [adminState, setAdminState] = useState('loading');
  const [session, setSession] = useState(null);
  const [authErrorKey, setAuthErrorKey] = useState('');
  const [signInErrorKey, setSignInErrorKey] = useState('');
  const [signInBusy, setSignInBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadErrorKey, setLoadErrorKey] = useState('');
  const [realtimeErrorKey, setRealtimeErrorKey] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [busyAction, setBusyAction] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');
  const [siteSettings, setSiteSettings] = useState(null);
  const [settingsStatus, setSettingsStatus] = useState('idle');
  const [settingsErrorKey, setSettingsErrorKey] = useState('');
  const [settingsRetryCount, setSettingsRetryCount] = useState(0);
  const [recipientFilter, setRecipientFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteErrorKey, setDeleteErrorKey] = useState('');
  const [activePhotoId, setActivePhotoId] = useState(null);

  const retryMessagesRef = useRef(null);
  const deleteDialogRef = useRef(null);
  const cancelDeleteRef = useRef(null);
  const deleteOpenerRef = useRef(null);
  const dashboardTitleRef = useRef(null);
  const statusTabRefs = useRef([]);
  const mutationInProgressRef = useRef(false);

  useEffect(() => {
    let active = true;
    let authEventObserved = false;

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      authEventObserved = true;
      setSession(nextSession);
      setMessages([]);
      setSiteSettings(null);
      setSettingsStatus('idle');
      setSettingsErrorKey('');
      setActiveTab('pending');
      setAuthErrorKey('');
      setAdminState(nextSession ? 'checkingAdmin' : 'signedOut');
    });

    async function checkSession() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!active || authEventObserved) return;
        setSession(data.session);
        setAdminState(data.session ? 'checkingAdmin' : 'signedOut');
      } catch (error) {
        console.error('Could not check the current admin session.', error);
        if (!active || authEventObserved) return;
        setAuthErrorKey('admin.sessionError');
        setAdminState('accessError');
      }
    }

    checkSession();
    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (adminState !== 'checkingAdmin' || !session) return undefined;
    let active = true;
    setMessages([]);
    setAuthErrorKey('');

    async function verifyAdmin() {
      try {
        const { data, error } = await supabase.rpc('is_admin');
        if (error) throw error;
        if (!active) return;
        setAdminState(data === true ? 'authorized' : 'unauthorized');
      } catch (error) {
        console.error('Could not verify admin membership.', error);
        if (!active) return;
        setAuthErrorKey('admin.accessCheckError');
        setAdminState('accessError');
      }
    }

    verifyAdmin();
    return () => {
      active = false;
    };
  }, [adminState, session]);

  useEffect(() => {
    if (adminState !== 'authorized') {
      retryMessagesRef.current = null;
      setLoadingMessages(false);
      return undefined;
    }

    let active = true;
    let initialLoadComplete = false;
    const pendingEvents = [];
    setMessages([]);
    setLoadingMessages(true);
    setLoadErrorKey('');
    setRealtimeErrorKey('');

    async function loadMessages() {
      setLoadingMessages(true);
      setLoadErrorKey('');
      try {
        const allMessages = await fetchAllMessages();
        if (!active) return;
        const mergedMessages = pendingEvents.reduce(applyRealtimeEvent, allMessages);
        pendingEvents.length = 0;
        initialLoadComplete = true;
        setMessages(mergedMessages);
      } catch (error) {
        console.error('Could not load messages for moderation.', error);
        if (active) setLoadErrorKey('admin.loadError');
      } finally {
        if (active) setLoadingMessages(false);
      }
    }

    retryMessagesRef.current = loadMessages;
    const channel = supabase
      .channel('admin-message-moderation')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
      }, (payload) => {
        if (!active) return;
        if (!initialLoadComplete) {
          pendingEvents.push(payload);
          return;
        }
        setMessages((currentMessages) => applyRealtimeEvent(currentMessages, payload));
      })
      .subscribe((status) => {
        if (!active) return;
        if (status === 'SUBSCRIBED') {
          setRealtimeErrorKey('');
        } else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) {
          console.error('Realtime moderation updates are unavailable.', status);
          setRealtimeErrorKey('admin.realtimeError');
        }
      });

    loadMessages();
    return () => {
      active = false;
      initialLoadComplete = false;
      pendingEvents.length = 0;
      retryMessagesRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [adminState]);

  useEffect(() => {
    if (
      adminState !== 'authorized'
      || !['photos', 'exports', 'settings'].includes(activeTab)
      || siteSettings
    ) return undefined;

    let active = true;
    setSettingsStatus('loading');
    setSettingsErrorKey('');

    async function loadSettings() {
      try {
        const { data, error } = await supabase
          .from('site_settings')
          .select(SITE_SETTINGS_COLUMNS)
          .eq('id', 1)
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('The site settings row is missing.');
        if (!active) return;
        setSiteSettings(data);
        setSettingsStatus('ready');
      } catch (error) {
        console.error('Could not load site settings for administration.', error);
        if (!active) return;
        setSettingsErrorKey('admin.settingsLoadError');
        setSettingsStatus('error');
      }
    }

    loadSettings();
    return () => {
      active = false;
    };
  }, [activeTab, adminState, settingsRetryCount, siteSettings]);

  useEffect(() => {
    if (deleteTarget) {
      const dialog = deleteDialogRef.current;
      if (dialog && !dialog.open) dialog.showModal();
      cancelDeleteRef.current?.focus();
      return () => {
        if (dialog?.open) dialog.close();
      };
    }

    const opener = deleteOpenerRef.current;
    if (opener) {
      deleteOpenerRef.current = null;
      if (opener.isConnected) opener.focus();
      else dashboardTitleRef.current?.focus();
    }
    return undefined;
  }, [deleteTarget]);

  useEffect(() => {
    if (deleteTarget && !messages.some((message) => message.id === deleteTarget.id)) {
      setDeleteTarget(null);
    }
  }, [deleteTarget, messages]);

  const tabCounts = useMemo(() => ({
    total: messages.length,
    pending: messages.filter((message) => !message.approved).length,
    approved: messages.filter((message) => Boolean(message.approved)).length,
    photos: messages.filter((message) => Boolean(message.photo_url)).length,
    pinned: messages.filter((message) => Boolean(message.pinned)).length,
  }), [messages]);

  const visibleMessages = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase(language);
    return messages
      .filter((message) => {
        if (activeTab === 'pending' && message.approved) return false;
        if (activeTab === 'approved' && !message.approved) return false;
        if (recipientFilter !== 'all' && message.recipient_type !== recipientFilter) return false;
        if (!normalizedSearch) return true;
        return [message.name, message.message]
          .some((value) => String(value || '').toLocaleLowerCase(language).includes(normalizedSearch));
      })
      .sort((first, second) => Number(Boolean(second.pinned)) - Number(Boolean(first.pinned))
        || new Date(second.created_at) - new Date(first.created_at));
  }, [activeTab, language, messages, recipientFilter, search]);

  const messagePhotoItems = useMemo(() => visibleMessages
    .filter((message) => message.photo_url)
    .map((message) => ({
      id: message.id,
      photo_url: message.photo_url,
      name: message.name,
      sender: message.name,
      message: message.message,
      created_at: message.created_at,
      alt: t('admin.photoAlt', { name: message.name }),
    })), [t, visibleMessages]);

  const galleryPhotos = useMemo(() => {
    const photos = [];
    const seenUrls = new Set();
    if (siteSettings?.baby_photo_url) {
      const sender = siteSettings.baby_name || t('admin.featuredPhoto');
      photos.push({
        id: 'featured-photo',
        photo_url: siteSettings.baby_photo_url,
        name: sender,
        sender,
        message: '',
        created_at: siteSettings.updated_at,
        dateLabel: siteSettings.updated_at
          ? formatRelativeDate(siteSettings.updated_at, language, t)
          : t('admin.dateUnknown'),
        statusLabel: t('admin.featuredPhotoStatus'),
        statusClass: 'is-featured',
        alt: t('admin.featuredPhotoAlt', { name: sender }),
      });
      seenUrls.add(siteSettings.baby_photo_url);
    }

    messages.forEach((message) => {
      if (!message.photo_url || seenUrls.has(message.photo_url)) return;
      seenUrls.add(message.photo_url);
      photos.push({
        id: message.id,
        photo_url: message.photo_url,
        name: message.name,
        sender: message.name,
        message: message.message,
        created_at: message.created_at,
        dateLabel: message.created_at
          ? formatRelativeDate(message.created_at, language, t)
          : t('admin.dateUnknown'),
        statusLabel: message.approved ? t('admin.approved') : t('admin.pending'),
        statusClass: message.approved ? 'is-approved' : 'is-pending',
        alt: t('admin.photoAlt', { name: message.name }),
      });
    });

    return photos;
  }, [language, messages, siteSettings, t]);

  const activePhotoItems = activeTab === 'photos' ? galleryPhotos : messagePhotoItems;
  const activePhotoIndex = activePhotoItems.findIndex((photo) => photo.id === activePhotoId);
  const activePhoto = activePhotoIndex >= 0 ? activePhotoItems[activePhotoIndex] : null;

  useEffect(() => {
    if (activePhotoId && activePhotoIndex < 0) setActivePhotoId(null);
  }, [activePhotoId, activePhotoIndex]);

  const closeLightbox = useCallback(() => setActivePhotoId(null), []);
  const showNextPhoto = useCallback(() => {
    if (activePhotoItems.length < 2) return;
    setActivePhotoId((currentId) => {
      const currentIndex = activePhotoItems.findIndex((photo) => photo.id === currentId);
      return currentIndex < 0
        ? null
        : activePhotoItems[(currentIndex + 1) % activePhotoItems.length].id;
    });
  }, [activePhotoItems]);
  const showPreviousPhoto = useCallback(() => {
    if (activePhotoItems.length < 2) return;
    setActivePhotoId((currentId) => {
      const currentIndex = activePhotoItems.findIndex((photo) => photo.id === currentId);
      return currentIndex < 0
        ? null
        : activePhotoItems[(currentIndex - 1 + activePhotoItems.length) % activePhotoItems.length].id;
    });
  }, [activePhotoItems]);

  async function handleSignIn(event) {
    event.preventDefault();
    setSignInErrorKey('');
    setSignInBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setSession(data.session);
      setAdminState(data.session ? 'checkingAdmin' : 'signedOut');
    } catch (error) {
      console.error('Could not sign in to message moderation.', error);
      setSignInErrorKey('admin.signInError');
    } finally {
      setSignInBusy(false);
    }
  }

  async function handleSignOut() {
    setAuthErrorKey('');
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setSession(null);
      setMessages([]);
      setSiteSettings(null);
      setSettingsStatus('idle');
      setSettingsErrorKey('');
      setActiveTab('pending');
      setAdminState('signedOut');
    } catch (error) {
      console.error('Could not sign out of message moderation.', error);
      setAuthErrorKey('admin.signOutError');
    }
  }

  async function retryAccessCheck() {
    setAuthErrorKey('');
    if (session) {
      setAdminState('checkingAdmin');
      return;
    }

    function retrySettingsLoad() {
      setSiteSettings(null);
      setSettingsStatus('idle');
      setSettingsRetryCount((count) => count + 1);
    }

    setAdminState('loading');
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      setSession(data.session);
      setAdminState(data.session ? 'checkingAdmin' : 'signedOut');
    } catch (error) {
      console.error('Could not recheck the admin session.', error);
      setAuthErrorKey('admin.sessionError');
      setAdminState('accessError');
    }
  }

  async function updateMessage(message, patch, successKey) {
    if (mutationInProgressRef.current) return;
    mutationInProgressRef.current = true;
    setBusyAction(true);
    setFeedback(null);
    try {
      const { data, error } = await supabase
        .from('messages')
        .update(patch)
        .eq('id', message.id)
        .select('*')
        .single();
      if (error) throw error;
      setMessages((currentMessages) => currentMessages.map((current) => (
        current.id === message.id ? data : current
      )));
      setFeedback({ type: 'success', key: successKey });
    } catch (error) {
      console.error('Could not update a moderated message.', error);
      setFeedback({ type: 'error', key: 'admin.updateError' });
    } finally {
      mutationInProgressRef.current = false;
      setBusyAction(false);
    }
  }

  function requestDelete(message, event) {
    deleteOpenerRef.current = event.currentTarget;
    setDeleteErrorKey('');
    setFeedback(null);
    setDeleteTarget(message);
  }

  async function confirmDelete() {
    if (!deleteTarget || mutationInProgressRef.current) return;
    mutationInProgressRef.current = true;
    setBusyAction(true);
    setDeleteErrorKey('');
    let deletingPhoto = true;

    try {
      if (deleteTarget.photo_url) {
        const path = getStoragePath(deleteTarget.photo_url, PHOTO_BUCKET);
        const { error: storageError } = await supabase.storage.from(PHOTO_BUCKET).remove([path]);
        if (storageError && !isMissingStorageObject(storageError)) throw storageError;
      }

      deletingPhoto = false;
      const { error } = await supabase.from('messages').delete().eq('id', deleteTarget.id);
      if (error) throw error;

      setMessages((currentMessages) => currentMessages.filter((message) => message.id !== deleteTarget.id));
      setDeleteTarget(null);
      setFeedback({ type: 'success', key: 'admin.deletedSuccess' });
    } catch (error) {
      console.error('Could not complete message deletion.', error);
      setDeleteErrorKey(deletingPhoto ? 'admin.deletePhotoError' : 'admin.deleteError');
    } finally {
      mutationInProgressRef.current = false;
      setBusyAction(false);
    }
  }

  function handleTabKeyDown(event, index) {
    const nextKey = language === 'ar' ? 'ArrowLeft' : 'ArrowRight';
    const previousKey = language === 'ar' ? 'ArrowRight' : 'ArrowLeft';
    let nextIndex = index;
    if (event.key === nextKey) nextIndex = (index + 1) % ADMIN_TABS.length;
    else if (event.key === previousKey) nextIndex = (index - 1 + ADMIN_TABS.length) % ADMIN_TABS.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = ADMIN_TABS.length - 1;
    else return;

    event.preventDefault();
    setActiveTab(ADMIN_TABS[nextIndex]);
    statusTabRefs.current[nextIndex]?.focus();
  }

  if (adminState === 'loading' || adminState === 'checkingAdmin') {
    return (
      <AdminAccessLayout>
        <PaperCard className="admin-access-card" role="status" aria-live="polite">
          <Loader2 className="admin-access-spinner" aria-hidden="true" />
          <p>{t(adminState === 'loading' ? 'admin.authChecking' : 'admin.accessChecking')}</p>
        </PaperCard>
      </AdminAccessLayout>
    );
  }

  if (adminState === 'signedOut') {
    return (
      <AdminAccessLayout>
        <PaperCard className="admin-access-card">
          <div className="admin-access-mark" aria-hidden="true"><Heart size={24} fill="currentColor" /></div>
          <h1>{t('admin.loginTitle')}</h1>
          <form onSubmit={handleSignIn} className="admin-signin-form">
            <label htmlFor="admin-email">{t('admin.email')}</label>
            <input
              id="admin-email"
              name="email"
              type="email"
              autoComplete="email"
              spellCheck={false}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              aria-invalid={Boolean(signInErrorKey)}
              aria-describedby={signInErrorKey ? 'admin-signin-error' : undefined}
            />
            <label htmlFor="admin-password">{t('admin.password')}</label>
            <input
              id="admin-password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              aria-invalid={Boolean(signInErrorKey)}
              aria-describedby={signInErrorKey ? 'admin-signin-error' : undefined}
            />
            {signInErrorKey && (
              <p id="admin-signin-error" className="admin-feedback is-error" role="alert" aria-live="assertive">
                {t(signInErrorKey)}
              </p>
            )}
            <button type="submit" className="btn-primary" disabled={signInBusy}>
              {signInBusy ? t('admin.actionBusy') : t('admin.signIn')}
            </button>
          </form>
        </PaperCard>
      </AdminAccessLayout>
    );
  }

  if (adminState === 'unauthorized') {
    return (
      <AdminAccessLayout>
        <PaperCard className="admin-access-card">
          <span className="admin-access-mark" aria-hidden="true"><User size={24} /></span>
          <h1>{t('admin.unauthorizedTitle')}</h1>
          <p>{t('admin.unauthorizedText')}</p>
          <p className="admin-access-note" role="status">{t('admin.noDataLoaded')}</p>
          {authErrorKey && <p className="admin-feedback is-error" role="alert">{t(authErrorKey)}</p>}
          <button type="button" className="btn-outline" onClick={handleSignOut}>
            <LogOut size={18} aria-hidden="true" />
            {t('admin.signOut')}
          </button>
        </PaperCard>
      </AdminAccessLayout>
    );
  }

  if (adminState === 'accessError') {
    return (
      <AdminAccessLayout>
        <PaperCard className="admin-access-card">
          <span className="admin-access-mark" aria-hidden="true"><User size={24} /></span>
          <h1>{t('admin.accessErrorTitle')}</h1>
          <p className="admin-feedback is-error" role="alert" aria-live="polite">
            {t(authErrorKey || 'admin.accessCheckError')}
          </p>
          <div className="admin-access-actions">
            <button type="button" className="btn-primary" onClick={retryAccessCheck}>{t('admin.retryAccess')}</button>
            {session && (
              <button type="button" className="btn-outline" onClick={handleSignOut}>
                <LogOut size={18} aria-hidden="true" />
                {t('admin.signOut')}
              </button>
            )}
          </div>
        </PaperCard>
      </AdminAccessLayout>
    );
  }

  const pendingMessages = tabCounts.pending;
  const tabLabels = {
    pending: t('admin.pendingTab'),
    approved: t('admin.approvedTab'),
    all: t('admin.allTab'),
    photos: t('admin.photosTab'),
    exports: t('admin.exportTab'),
    settings: t('admin.settingsTab'),
  };
  return (
    <>
      <main id="main" className="admin-dashboard theme-bg theme-text">
        <header className="admin-header">
          <div className="admin-header-inner">
            <div className="admin-heading-group">
              <span className="admin-heading-icon" aria-hidden="true"><User size={22} /></span>
              <div>
                <h1 ref={dashboardTitleRef} tabIndex={-1}>{t('admin.dashboardTitle')}</h1>
                <p>{t('admin.dashboardSubtitle')}</p>
              </div>
            </div>
            <div className="admin-header-actions">
              <LanguageSwitcher />
              <button type="button" className="btn-outline admin-signout" onClick={handleSignOut}>
                <LogOut size={18} aria-hidden="true" />
                {t('admin.signOut')}
              </button>
            </div>
          </div>
        </header>

        <div className="admin-main">
          {authErrorKey && (
            <p className="admin-feedback is-error" role="alert" aria-live="polite">{t(authErrorKey)}</p>
          )}
          {feedback && (
            <p className={`admin-feedback ${feedback.type === 'success' ? 'is-success' : 'is-error'}`}
              role={feedback.type === 'success' ? 'status' : 'alert'}
              aria-live={feedback.type === 'success' ? 'polite' : 'assertive'}
            >
              {t(feedback.key)}
            </p>
          )}
          {realtimeErrorKey && (
            <p className="admin-feedback is-error" role="status" aria-live="polite">{t(realtimeErrorKey)}</p>
          )}

          <section className="admin-overview" aria-label={t('admin.overview')}>
            <OverviewCard label={t('admin.totalMessages')} value={tabCounts.total} />
            <OverviewCard label={t('admin.pendingCountLabel')} value={tabCounts.pending} />
            <OverviewCard label={t('admin.approvedCountLabel')} value={tabCounts.approved} />
            <OverviewCard label={t('admin.messagesWithPhotos')} value={tabCounts.photos} />
            <OverviewCard label={t('admin.pinnedMessages')} value={tabCounts.pinned} />
          </section>

          <div className="admin-toolbar">
            <div className="admin-tabs" role="tablist" aria-label={t('admin.dashboardTabs')}>
              {ADMIN_TABS.map((tab, index) => (
                <button
                  key={tab}
                  ref={(element) => { statusTabRefs.current[index] = element; }}
                  id={`admin-tab-${tab}`}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab}
                  aria-controls="admin-content-panel"
                  tabIndex={activeTab === tab ? 0 : -1}
                  className={activeTab === tab ? 'is-active' : ''}
                  onClick={() => setActiveTab(tab)}
                  onKeyDown={(event) => handleTabKeyDown(event, index)}
                >
                  {tab === 'photos' && <ImageIcon size={16} aria-hidden="true" />}
                  {tab === 'exports' && <Download size={16} aria-hidden="true" />}
                  {tab === 'settings' && <SettingsIcon size={16} aria-hidden="true" />}
                  {tabLabels[tab]}
                  {tab === 'pending' && (
                    <span
                      className="admin-pending-count"
                      aria-label={t('admin.pendingCount', { count: pendingMessages })}
                    >
                      {pendingMessages}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {MESSAGE_TABS.includes(activeTab) && <div className="admin-filters">
              <div className="admin-search">
                <label htmlFor="admin-search">{t('admin.searchLabel')}</label>
                <div className="admin-search-control">
                  <Search size={18} aria-hidden="true" />
                  <input
                    id="admin-search"
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={t('admin.searchPlaceholder')}
                  />
                  {search && (
                    <button type="button" className="admin-clear-search" onClick={() => setSearch('')} aria-label={t('admin.clearSearch')}>
                      <X size={18} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
              <fieldset className="admin-recipient-filter">
                <legend>{t('admin.recipientFilter')}</legend>
                <div role="group" aria-label={t('admin.recipientFilter')}>
                  {RECIPIENT_FILTERS.map((recipient) => (
                    <button
                      key={recipient}
                      type="button"
                      aria-pressed={recipientFilter === recipient}
                      className={recipientFilter === recipient ? 'is-active' : ''}
                      onClick={() => setRecipientFilter(recipient)}
                    >
                      {recipient === 'all' ? t('admin.allRecipients') : t(`guestbook.${recipient}`)}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>}
          </div>

          <section
            id="admin-content-panel"
            className="admin-message-panel"
            role="tabpanel"
            aria-labelledby={`admin-tab-${activeTab}`}
            tabIndex={0}
          >
            {activeTab === 'exports' ? (
              loadingMessages ? (
                <div className="admin-loading" role="status" aria-live="polite">
                  <Loader2 className="admin-access-spinner" aria-hidden="true" />
                  <span>{t('admin.loading')}</span>
                </div>
              ) : loadErrorKey ? (
                <div className="admin-list-error" role="alert" aria-live="polite">
                  <p>{t(loadErrorKey)}</p>
                  <button type="button" className="btn-outline" onClick={() => retryMessagesRef.current?.()}>
                    {t('admin.retryLoad')}
                  </button>
                </div>
              ) : settingsStatus === 'error' ? (
                <div className="admin-list-error" role="alert" aria-live="polite">
                  <p>{t(settingsErrorKey || 'admin.settingsLoadError')}</p>
                  <button type="button" className="btn-outline" onClick={retrySettingsLoad}>
                    {t('admin.retryLoad')}
                  </button>
                </div>
              ) : settingsStatus !== 'ready' || !siteSettings ? (
                <div className="admin-loading" role="status" aria-live="polite">
                  <Loader2 className="admin-access-spinner" aria-hidden="true" />
                  <span>{t('admin.settingsLoading')}</span>
                </div>
              ) : (
                <AdminExports
                  messages={messages}
                  babyName={siteSettings.baby_name}
                  featuredPhotoUrl={siteSettings.baby_photo_url}
                  themeName={siteSettings.theme}
                />
              )
            ) : activeTab === 'settings' ? (
              settingsStatus === 'error' ? (
                <div className="admin-list-error" role="alert" aria-live="polite">
                  <p>{t(settingsErrorKey || 'admin.settingsLoadError')}</p>
                  <button type="button" className="btn-outline" onClick={retrySettingsLoad}>
                    {t('admin.retryLoad')}
                  </button>
                </div>
              ) : settingsStatus !== 'ready' || !siteSettings ? (
                <div className="admin-loading" role="status" aria-live="polite">
                  <Loader2 className="admin-access-spinner" aria-hidden="true" />
                  <span>{t('admin.settingsLoading')}</span>
                </div>
              ) : (
                <AdminSettings
                  settings={siteSettings}
                  onSaved={(savedSettings) => {
                    setSiteSettings(savedSettings);
                    setSettingsStatus('ready');
                  }}
                />
              )
            ) : activeTab === 'photos' ? (
              loadErrorKey ? (
                <div className="admin-list-error" role="alert" aria-live="polite">
                  <p>{t(loadErrorKey)}</p>
                  <button type="button" className="btn-outline" onClick={() => retryMessagesRef.current?.()}>
                    {t('admin.retryLoad')}
                  </button>
                </div>
              ) : loadingMessages || settingsStatus === 'loading' || settingsStatus === 'idle' ? (
                <div className="admin-loading" role="status" aria-live="polite">
                  <Loader2 className="admin-access-spinner" aria-hidden="true" />
                  <span>{t('admin.settingsLoading')}</span>
                </div>
              ) : settingsStatus === 'error' ? (
                <div className="admin-list-error" role="alert" aria-live="polite">
                  <p>{t(settingsErrorKey || 'admin.settingsLoadError')}</p>
                  <button type="button" className="btn-outline" onClick={retrySettingsLoad}>
                    {t('admin.retryLoad')}
                  </button>
                </div>
              ) : (
                <AdminPhotos
                  photos={galleryPhotos}
                  onOpenPhoto={setActivePhotoId}
                />
              )
            ) : loadingMessages ? (
              <div className="admin-loading" role="status" aria-live="polite">
                <Loader2 className="admin-access-spinner" aria-hidden="true" />
                <span>{t('admin.loading')}</span>
              </div>
            ) : loadErrorKey ? (
              <div className="admin-list-error" role="alert" aria-live="polite">
                <p>{t(loadErrorKey)}</p>
                <button type="button" className="btn-outline" onClick={() => retryMessagesRef.current?.()}>
                  {t('admin.retryLoad')}
                </button>
              </div>
            ) : visibleMessages.length === 0 ? (
              <PaperCard className="admin-empty-state">
                <ScrapbookLabel>{tabLabels[activeTab]}</ScrapbookLabel>
                <h2>{search.trim() || recipientFilter !== 'all'
                  ? t('admin.emptySearch')
                  : t(`admin.empty${activeTab.charAt(0).toUpperCase()}${activeTab.slice(1)}`)}
                </h2>
                {(search.trim() || recipientFilter !== 'all') && (
                  <button type="button" className="btn-outline" onClick={() => {
                    setSearch('');
                    setRecipientFilter('all');
                  }}>
                    {t('admin.clearFilters')}
                  </button>
                )}
              </PaperCard>
            ) : (
              <>
                <div className="admin-mobile-messages">
                  {visibleMessages.map((message) => (
                    <PaperCard className="admin-mobile-message" key={message.id}>
                      <div className="admin-mobile-message-head">
                        <div>
                          <h2 dir="auto">{message.name}</h2>
                          <StatusBadge approved={Boolean(message.approved)} pinned={Boolean(message.pinned)} />
                        </div>
                        <AdminPhoto
                          message={message}
                          onOpen={() => setActivePhotoId(message.id)}
                        />
                      </div>
                      <p className="admin-message-text" dir="auto">{message.message}</p>
                      <div className="admin-message-meta">
                        <span>{t('admin.messageRecipient', {
                          recipient: message.recipient_type === 'parents'
                            ? t('guestbook.parents')
                            : t('guestbook.baby'),
                        })}</span>
                        <time dateTime={message.created_at}>
                          {formatRelativeDate(message.created_at, language, t)}
                        </time>
                      </div>
                      <MessageActions
                        message={message}
                        busy={busyAction}
                        onApproval={(item) => updateMessage(
                          item,
                          { approved: !item.approved },
                          item.approved ? 'admin.unapprovedSuccess' : 'admin.approvedSuccess',
                        )}
                        onPin={(item) => updateMessage(
                          item,
                          { pinned: !item.pinned },
                          item.pinned ? 'admin.unpinnedSuccess' : 'admin.pinnedSuccess',
                        )}
                        onDelete={requestDelete}
                      />
                    </PaperCard>
                  ))}
                </div>

                <div className="admin-desktop-table">
                  <div className="admin-table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th scope="col">{t('admin.name')}</th>
                          <th scope="col">{t('admin.message')}</th>
                          <th scope="col">{t('admin.recipientFilter')}</th>
                          <th scope="col">{t('admin.date')}</th>
                          <th scope="col">{t('admin.photo')}</th>
                          <th scope="col">{t('admin.status')}</th>
                          <th scope="col">{t('admin.actions')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleMessages.map((message) => (
                          <tr key={message.id}>
                            <td className="admin-sender" dir="auto">{message.name}</td>
                            <td><p className="admin-message-text" dir="auto">{message.message}</p></td>
                            <td>{message.recipient_type === 'parents' ? t('guestbook.parents') : t('guestbook.baby')}</td>
                            <td><time dateTime={message.created_at}>{formatRelativeDate(message.created_at, language, t)}</time></td>
                            <td>
                              <AdminPhoto message={message} onOpen={() => setActivePhotoId(message.id)} />
                            </td>
                            <td><StatusBadge approved={Boolean(message.approved)} pinned={Boolean(message.pinned)} /></td>
                            <td>
                              <MessageActions
                                message={message}
                                busy={busyAction}
                                onApproval={(item) => updateMessage(
                                  item,
                                  { approved: !item.approved },
                                  item.approved ? 'admin.unapprovedSuccess' : 'admin.approvedSuccess',
                                )}
                                onPin={(item) => updateMessage(
                                  item,
                                  { pinned: !item.pinned },
                                  item.pinned ? 'admin.unpinnedSuccess' : 'admin.pinnedSuccess',
                                )}
                                onDelete={requestDelete}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>

        {deleteTarget && (
          <dialog
            ref={deleteDialogRef}
            className="admin-delete-dialog"
            aria-labelledby="admin-delete-title"
            aria-describedby="admin-delete-description"
            onCancel={(event) => {
              event.preventDefault();
              if (!busyAction) setDeleteTarget(null);
            }}
            onClick={(event) => {
              if (event.target === event.currentTarget && !busyAction) setDeleteTarget(null);
            }}
          >
            <h2 id="admin-delete-title">{t('admin.deleteTitle')}</h2>
            <p id="admin-delete-description">{t('admin.deleteDescription')}</p>
            {deleteErrorKey && (
              <p className="admin-feedback is-error" role="alert" aria-live="assertive">{t(deleteErrorKey)}</p>
            )}
            <div className="admin-dialog-actions">
              <button
                ref={cancelDeleteRef}
                type="button"
                className="btn-outline"
                onClick={() => setDeleteTarget(null)}
                disabled={busyAction}
              >
                {t('admin.cancel')}
              </button>
              <button type="button" className="admin-delete-confirm" onClick={confirmDelete} disabled={busyAction}>
                {busyAction ? t('admin.deleting') : t('admin.confirmDelete')}
              </button>
            </div>
          </dialog>
        )}
      </main>

      <Lightbox
        isOpen={Boolean(activePhoto)}
        photo={activePhoto}
        photoCount={activePhotoItems.length}
        onClose={closeLightbox}
        onNext={showNextPhoto}
        onPrevious={showPreviousPhoto}
      />
    </>
  );
}
