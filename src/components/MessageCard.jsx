import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import {
  PaperCard,
  PolaroidFrame,
  ScrapbookLabel,
  ScrapbookSticker,
} from './ScrapbookComponents.jsx';
import { useI18n } from '../i18n/index.js';

export function MessageCard({ message, layout, onOpenPhoto }) {
  const { language, t } = useI18n();
  const [imageFailed, setImageFailed] = useState(false);
  const date = new Date(message.created_at);
  const readableDate = Number.isNaN(date.getTime())
    ? ''
    : new Intl.DateTimeFormat(language, { dateStyle: 'medium' }).format(date);
  const recipientLabel = message.recipient_type === 'parents'
    ? t('guestbook.parents')
    : t('guestbook.baby');
  const photoAlt = t('memories.photoAlt', { name: message.name });

  return (
    <PaperCard className={`memory-card memory-card--${layout}`} data-pinned={message.pinned ? 'true' : undefined}>
      {message.pinned && (
        <ScrapbookSticker className="memory-pin" icon="star">{t('memories.pinned')}</ScrapbookSticker>
      )}
      <ScrapbookLabel className="memory-recipient">{recipientLabel}</ScrapbookLabel>

      {message.photo_url && (
        <PolaroidFrame
          src={imageFailed ? null : message.photo_url}
          alt={photoAlt}
          caption={imageFailed ? t('lightbox.unavailable') : message.name}
          tilt={layout === 'portrait' ? '2deg' : '-1deg'}
          onClick={imageFailed ? undefined : () => onOpenPhoto(message)}
          buttonLabel={t('memories.openPhoto', { name: message.name })}
          onError={() => setImageFailed(true)}
        >
          <span className="photo-fallback">
            <ImageOff size={28} aria-hidden="true" />
            <span>{t('lightbox.unavailable')}</span>
          </span>
        </PolaroidFrame>
      )}

      <p className="memory-message" dir="auto">{message.message}</p>
      <footer className="memory-signature">
        <p dir="auto">{message.name}</p>
        {readableDate && <time dateTime={message.created_at}>{readableDate}</time>}
      </footer>
    </PaperCard>
  );
}
