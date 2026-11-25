import { useState } from 'react';
import { Download, ImageOff, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase.js';
import { useI18n } from '../../i18n/index.js';
import { getStoragePath } from '../../utils/storage.js';
import { PaperCard, ScrapbookLabel } from '../ScrapbookComponents.jsx';

const PHOTO_BUCKET = 'baby-photos';

function getDownloadName(photo, path) {
  const extension = path.split('.').pop()?.replace(/[^a-z0-9]/gi, '') || 'jpg';
  const sender = String(photo.sender || '')
    .normalize('NFKD')
    .replace(/[^\w-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return `${sender || 'baby-photo'}.${extension}`;
}

function PhotoGalleryImage({ photo, onOpen, t }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="admin-gallery-image admin-gallery-image--failed" role="img" aria-label={photo.alt}>
        <ImageOff size={28} aria-hidden="true" />
        <span>{t('admin.photoUnavailable')}</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="admin-gallery-image"
      aria-label={t('admin.openPhoto', { name: photo.sender })}
      onClick={onOpen}
    >
      <img
        src={photo.photo_url}
        alt={photo.alt}
        width="800"
        height="600"
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </button>
  );
}

export function AdminPhotos({ photos, onOpenPhoto }) {
  const { t } = useI18n();
  const [downloadingId, setDownloadingId] = useState(null);
  const [feedback, setFeedback] = useState(null);

  async function downloadPhoto(photo) {
    if (downloadingId) return;
    setDownloadingId(photo.id);
    setFeedback(null);

    try {
      const path = getStoragePath(photo.photo_url, PHOTO_BUCKET);
      const { data, error } = await supabase.storage.from(PHOTO_BUCKET).download(path);
      if (error) throw error;
      if (!(data instanceof Blob)) throw new Error('The photo download did not return a file.');

      const objectUrl = URL.createObjectURL(data);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = getDownloadName(photo, path);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setFeedback({ type: 'success', key: 'admin.photoDownloadStarted' });
    } catch (error) {
      console.error('Could not download a photo from the gallery.', error);
      setFeedback({ type: 'error', key: 'admin.photoDownloadError' });
    } finally {
      setDownloadingId(null);
    }
  }

  if (photos.length === 0) {
    return (
      <PaperCard className="admin-empty-state">
        <ScrapbookLabel>{t('admin.photosTab')}</ScrapbookLabel>
        <h2>{t('admin.photosEmptyTitle')}</h2>
        <p>{t('admin.photosEmptyText')}</p>
      </PaperCard>
    );
  }

  return (
    <div className="admin-photos">
      {feedback && (
        <p
          className={`admin-feedback ${feedback.type === 'success' ? 'is-success' : 'is-error'}`}
          role={feedback.type === 'success' ? 'status' : 'alert'}
          aria-live={feedback.type === 'success' ? 'polite' : 'assertive'}
        >
          {t(feedback.key)}
        </p>
      )}
      <div className="admin-photo-gallery">
        {photos.map((photo) => (
          <PaperCard className="admin-photo-card" key={photo.id}>
            <PhotoGalleryImage
              photo={photo}
              onOpen={() => onOpenPhoto(photo.id)}
              t={t}
            />
            <div className="admin-photo-card-details">
              <div className="admin-photo-card-meta">
                <h2 dir="auto">{photo.sender}</h2>
                <span className={`admin-status-badge ${photo.statusClass}`}>
                  {photo.statusLabel}
                </span>
              </div>
              <time dateTime={photo.created_at || undefined}>
                {photo.dateLabel}
              </time>
              {photo.message && <p dir="auto">{photo.message}</p>}
              <button
                type="button"
                className="admin-action-button"
                onClick={() => downloadPhoto(photo)}
                disabled={Boolean(downloadingId)}
                aria-label={t('admin.downloadPhotoFor', { name: photo.sender })}
              >
                {downloadingId === photo.id
                  ? <Loader2 className="admin-access-spinner" size={17} aria-hidden="true" />
                  : <Download size={17} aria-hidden="true" />}
                {downloadingId === photo.id ? t('admin.photoDownloading') : t('admin.downloadPhoto')}
              </button>
            </div>
          </PaperCard>
        ))}
      </div>
    </div>
  );
}
