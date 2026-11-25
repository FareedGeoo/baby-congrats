import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Heart, ImagePlus, Mail, X } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import { validateImageFile, compressImage } from '../utils/compressImage.js';
import { useI18n } from '../i18n/index.js';
import { PaperCard, ScrapbookIcon, ScrapbookLabel, WashiTape } from './ScrapbookComponents.jsx';

export function GuestbookForm({ guestbookOpen }) {
  const { t } = useI18n();
  const nameInputRef = useRef(null);
  const photoInputRef = useRef(null);
  const submittingRef = useRef(false);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [recipient, setRecipient] = useState('baby');
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorKey, setErrorKey] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
  }, [photoPreview]);

  function clearPhoto() {
    setPhoto(null);
    setPhotoPreview(null);
    setFieldErrors((current) => ({ ...current, photo: '' }));
    if (photoInputRef.current) photoInputRef.current.value = '';
  }

  function handlePhotoChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      const error = validation.errorCode === 'invalidType'
        ? 'guestbook.photoTypeError'
        : 'guestbook.photoSizeError';
      clearPhoto();
      setErrorKey('');
      setFieldErrors((current) => ({ ...current, photo: error }));
      return;
    }

    setErrorKey('');
    setFieldErrors((current) => ({ ...current, photo: '' }));
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submittingRef.current) return;

    const errors = {
      name: name.trim() ? '' : 'guestbook.nameError',
      message: message.trim() ? '' : 'guestbook.messageError',
    };
    if (errors.name || errors.message) {
      setFieldErrors((current) => ({ ...current, ...errors }));
      setErrorKey('guestbook.requiredError');
      if (errors.name) nameInputRef.current?.focus();
      else document.getElementById('guestbook-message')?.focus();
      return;
    }

    setFieldErrors({});
    setErrorKey('');
    submittingRef.current = true;
    setSubmitting(true);

    try {
      let photoUrl = null;
      if (photo) {
        const compressed = await compressImage(photo);
        const extension = compressed.name.split('.').pop() || 'webp';
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from('baby-photos')
          .upload(fileName, compressed, { cacheControl: '3600', upsert: false });

        if (uploadError) throw uploadError;
        photoUrl = supabase.storage.from('baby-photos').getPublicUrl(fileName).data.publicUrl;
      }

      const { error: insertError } = await supabase.from('messages').insert({
        name: name.trim(),
        message: message.trim(),
        photo_url: photoUrl,
        recipient_type: recipient,
        approved: false,
        pinned: false,
      });

      if (insertError) throw insertError;

      setSubmitted(true);
      setName('');
      setMessage('');
      setRecipient('baby');
      clearPhoto();
    } catch (error) {
      console.error('Could not submit a guestbook message.', error);
      setErrorKey('guestbook.submitError');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  if (!guestbookOpen) {
    return (
      <PaperCard className="guestbook-state" aria-labelledby="guestbook-title">
        <ScrapbookIcon name="cloud" size={38} />
        <h2 id="guestbook-title">{t('guestbook.closedTitle')}</h2>
        <p>{t('guestbook.closedText')}</p>
      </PaperCard>
    );
  }

  if (submitted) {
    return (
      <PaperCard className="guestbook-state guestbook-state--success" role="status" aria-live="polite">
        <WashiTape />
        <div className="guestbook-state-icon"><CheckCircle2 size={30} aria-hidden="true" /></div>
        <ScrapbookLabel>{t('guestbook.successTitle')}</ScrapbookLabel>
        <p>{t('guestbook.successText')}</p>
      </PaperCard>
    );
  }

  return (
    <PaperCard className="guestbook-form-card">
      <WashiTape />
      <div className="guestbook-form-heading">
        <div className="guestbook-heart" aria-hidden="true"><Heart size={20} /></div>
        <div>
          <h2>{t('guestbook.title')}</h2>
          <p>{t('guestbook.subtitle')}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="guestbook-fields">
          <div className="guestbook-field">
            <label htmlFor="guestbook-name">{t('guestbook.name')}</label>
            <input
              ref={nameInputRef}
              id="guestbook-name"
              name="name"
              type="text"
              value={name}
              maxLength={100}
              autoComplete="name"
              placeholder={t('guestbook.namePlaceholder')}
              dir="auto"
              required
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={fieldErrors.name ? 'guestbook-name-error' : undefined}
              onChange={(event) => {
                setName(event.target.value);
                setErrorKey('');
                setFieldErrors((current) => ({ ...current, name: '' }));
              }}
            />
            {fieldErrors.name && <p id="guestbook-name-error" className="field-error">{t(fieldErrors.name)}</p>}
          </div>

          <fieldset className="guestbook-field guestbook-recipient">
            <legend>{t('guestbook.recipient')}</legend>
            <div className="recipient-options">
              {['baby', 'parents'].map((type) => (
                <label key={type} className={recipient === type ? 'recipient-option is-selected' : 'recipient-option'}>
                  <input
                    type="radio"
                    name="recipient_type"
                    value={type}
                    checked={recipient === type}
                    onChange={() => setRecipient(type)}
                  />
                  <span>{t(`guestbook.${type}`)}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="guestbook-field">
            <label htmlFor="guestbook-message">{t('guestbook.message')}</label>
            <textarea
              id="guestbook-message"
              name="message"
              value={message}
              rows={5}
              maxLength={2000}
              placeholder={t('guestbook.messagePlaceholder')}
              dir="auto"
              required
              aria-invalid={Boolean(fieldErrors.message)}
              aria-describedby={fieldErrors.message ? 'guestbook-message-error' : undefined}
              onChange={(event) => {
                setMessage(event.target.value);
                setErrorKey('');
                setFieldErrors((current) => ({ ...current, message: '' }));
              }}
            />
            {fieldErrors.message && (
              <p id="guestbook-message-error" className="field-error">{t(fieldErrors.message)}</p>
            )}
          </div>

          <div className="guestbook-field">
            <label htmlFor="guestbook-photo">{t('guestbook.photo')}</label>
            <p className="guestbook-photo-help">{t('guestbook.photoHelp')}</p>
            <input
              ref={photoInputRef}
              id="guestbook-photo"
              name="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={submitting}
              aria-invalid={Boolean(fieldErrors.photo)}
              aria-describedby={fieldErrors.photo ? 'guestbook-photo-error' : 'guestbook-photo-help'}
              onChange={handlePhotoChange}
            />
            <span id="guestbook-photo-help" className="sr-only">{t('guestbook.photoHelp')}</span>
            {fieldErrors.photo && (
              <p id="guestbook-photo-error" className="field-error">{t(fieldErrors.photo)}</p>
            )}
            {photoPreview && (
              <div className="guestbook-photo-preview">
                <img src={photoPreview} alt={t('guestbook.photoPreviewAlt')} width="240" height="180" />
                <span><ImagePlus size={16} aria-hidden="true" />{t('guestbook.photoSelected')}</span>
                <button type="button" className="remove-photo-button" onClick={clearPhoto} disabled={submitting}>
                  <X size={16} aria-hidden="true" />
                  {t('guestbook.removePhoto')}
                </button>
              </div>
            )}
          </div>

          {errorKey && <p className="guestbook-error" role="alert" aria-live="assertive">{t(errorKey)}</p>}
        </div>

        <button type="submit" className="btn-primary guestbook-submit" disabled={submitting}>
          <span className="sr-only" role="status" aria-live="polite">
            {submitting ? t('guestbook.submitting') : ''}
          </span>
          <Mail size={18} aria-hidden="true" />
          {submitting ? t('guestbook.submitting') : t('guestbook.submit')}
        </button>
      </form>
    </PaperCard>
  );
}
