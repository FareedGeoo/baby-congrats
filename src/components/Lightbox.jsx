import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useI18n } from '../i18n/index.js';

export function Lightbox({
  isOpen,
  photo,
  photoCount,
  onClose,
  onNext,
  onPrevious,
}) {
  const { language, t } = useI18n();
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const previousFocusRef = useRef(null);
  const touchStartRef = useRef(null);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [photo?.id, photo?.photo_url]);

  useEffect(() => {
    if (!isOpen) return undefined;

    previousFocusRef.current = document.activeElement;
    closeButtonRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.documentElement.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'contain';

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      const nextKey = language === 'ar' ? 'ArrowLeft' : 'ArrowRight';
      const previousKey = language === 'ar' ? 'ArrowRight' : 'ArrowLeft';
      if (photoCount > 1 && event.key === nextKey) {
        event.preventDefault();
        onNext();
      } else if (photoCount > 1 && event.key === previousKey) {
        event.preventDefault();
        onPrevious();
      }

      if (event.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll('button:not([disabled])');
      if (!focusable?.length) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!dialogRef.current?.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      document.documentElement.style.overscrollBehavior = previousOverscroll;
      previousFocusRef.current?.focus();
    };
  }, [isOpen, language, onClose, onNext, onPrevious, photoCount]);

  if (!isOpen || !photo) return null;

  function handleTouchStart(event) {
    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }

  function handleTouchEnd(event) {
    if (!touchStartRef.current) return;
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (photoCount < 2) return;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) < Math.abs(deltaY)) return;
    const swipedForward = language === 'ar' ? deltaX > 0 : deltaX < 0;
    if (swipedForward) onNext();
    else onPrevious();
  }

  return (
    <div
      ref={dialogRef}
      className="memory-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={t('lightbox.dialogLabel')}
      tabIndex={-1}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <button
        ref={closeButtonRef}
        type="button"
        className="lightbox-close"
        onClick={onClose}
        aria-label={t('lightbox.close')}
      >
        <X size={23} aria-hidden="true" />
      </button>

      {photoCount > 1 && (
        <>
          <button type="button" className="lightbox-previous" onClick={onPrevious} aria-label={t('lightbox.previous')}>
            {language === 'ar'
              ? <ChevronRight size={28} aria-hidden="true" />
              : <ChevronLeft size={28} aria-hidden="true" />}
          </button>
          <button type="button" className="lightbox-next" onClick={onNext} aria-label={t('lightbox.next')}>
            {language === 'ar'
              ? <ChevronLeft size={28} aria-hidden="true" />
              : <ChevronRight size={28} aria-hidden="true" />}
          </button>
        </>
      )}

      <div className="lightbox-stage">
        {imageFailed ? (
          <div className="lightbox-fallback" role="status">
            <span>{t('lightbox.unavailable')}</span>
          </div>
        ) : (
          <img
            src={photo.photo_url}
            alt={photo.alt}
            width="1200"
            height="900"
            className="lightbox-image"
            onError={() => setImageFailed(true)}
          />
        )}
        <div className="lightbox-caption">
          {photo.message && <p dir="auto">{photo.message}</p>}
          <span dir="auto">{photo.name || photo.caption}</span>
        </div>
      </div>
    </div>
  );
}
