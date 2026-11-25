import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase.js';
import { useI18n } from '../../i18n/index.js';
import { isTheme, themes } from '../../themes/index.js';
import { compressImage, validateImageFile } from '../../utils/compressImage.js';
import { SITE_SETTINGS_COLUMNS } from '../../utils/siteSettings.js';
import { getStoragePath, isMissingStorageObject } from '../../utils/storage.js';
import { PaperCard, PolaroidFrame, ScrapbookIcon, ScrapbookLabel } from '../ScrapbookComponents.jsx';

const PHOTO_BUCKET = 'baby-photos';

function getFormValues(settings) {
  return {
    baby_name: settings.baby_name || '',
    mother_name: settings.mother_name || '',
    father_name: settings.father_name || '',
    birth_date: settings.birth_date || '',
    birth_time: settings.birth_time?.slice(0, 5) || '',
    birth_weight: settings.birth_weight == null ? '' : String(settings.birth_weight),
    birth_length: settings.birth_length == null ? '' : String(settings.birth_length),
    welcome_title_en: settings.welcome_title_en || '',
    welcome_title_ar: settings.welcome_title_ar || '',
    welcome_message_en: settings.welcome_message_en || '',
    welcome_message_ar: settings.welcome_message_ar || '',
    theme: settings.theme,
    allow_visitor_theme_change: settings.allow_visitor_theme_change,
    guestbook_open: settings.guestbook_open,
  };
}

function nullableText(value) {
  return value.trim() || null;
}

function getLastSavedLabel(value, language) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function AdminSettings({ settings, onSaved }) {
  const { language, t } = useI18n();
  const [form, setForm] = useState(() => getFormValues(settings));
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState(null);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [photoErrorKey, setPhotoErrorKey] = useState('');
  const [validationErrors, setValidationErrors] = useState({});
  const [errorKey, setErrorKey] = useState('');
  const [photoCleanupWarning, setPhotoCleanupWarning] = useState(false);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(getFormValues(settings));
    setPhotoFile(null);
    setPhotoPreviewUrl(null);
    setPhotoErrorKey('');
    setValidationErrors({});
  }, [settings]);

  useEffect(() => () => {
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
  }, [photoPreviewUrl]);

  const previewPhoto = photoPreviewUrl || settings.baby_photo_url;
  const themeStyle = themes[form.theme]?.cssVariables || themes.boy.cssVariables;
  const previewTitle = language === 'ar' ? form.welcome_title_ar : form.welcome_title_en;
  const previewMessage = language === 'ar' ? form.welcome_message_ar : form.welcome_message_en;
  const previewName = form.baby_name.trim() || t('hero.defaultBabyName');
  const lastSaved = useMemo(
    () => getLastSavedLabel(settings.updated_at, language),
    [language, settings.updated_at],
  );

  function updateField(event) {
    const { name, type, value, checked } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }));
    setValidationErrors((current) => ({ ...current, [name]: '' }));
    setErrorKey('');
    setSuccess(false);
    setPhotoCleanupWarning(false);
  }

  function handlePhotoChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      setPhotoFile(null);
      setPhotoPreviewUrl(null);
      setPhotoFailed(false);
      setPhotoErrorKey(
        validation.errorCode === 'invalidType'
          ? 'admin.settingsPhotoTypeError'
          : 'admin.settingsPhotoSizeError',
      );
      event.target.value = '';
      return;
    }

    setPhotoFile(file);
    setPhotoPreviewUrl(URL.createObjectURL(file));
    setPhotoFailed(false);
    setPhotoErrorKey('');
    setErrorKey('');
    setSuccess(false);
    setPhotoCleanupWarning(false);
  }

  function validateForm() {
    const errors = {};
    for (const field of ['birth_weight', 'birth_length']) {
      const value = form[field].trim();
      if (value && !Number.isFinite(Number(value))) errors[field] = 'admin.settingsNumberError';
    }
    if (!isTheme(form.theme)) errors.theme = 'admin.settingsThemeError';
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSave(event) {
    event.preventDefault();
    if (saving) return;
    setErrorKey('');
    setPhotoErrorKey('');
    setPhotoCleanupWarning(false);
    setSuccess(false);

    if (!validateForm()) {
      setErrorKey('admin.settingsValidationError');
      return;
    }

    setSaving(true);
    let uploadAttempted = false;
    let uploadedPath = '';
    let savedSettings = null;
    let rollbackFailed = false;
    let nextPhotoUrl = settings.baby_photo_url;

    try {
      if (photoFile) {
        const compressedPhoto = await compressImage(photoFile);
        if (compressedPhoto.size >= 5 * 1024 * 1024) {
          setPhotoErrorKey('admin.settingsPhotoSizeError');
          return;
        }

        const randomId = globalThis.crypto?.randomUUID?.()
          || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        uploadedPath = `baby/${randomId}.webp`;
        uploadAttempted = true;
        const { error: uploadError } = await supabase.storage
          .from(PHOTO_BUCKET)
          .upload(uploadedPath, compressedPhoto, {
            cacheControl: '3600',
            contentType: compressedPhoto.type,
            upsert: false,
          });
        if (uploadError) throw uploadError;

        nextPhotoUrl = supabase.storage
          .from(PHOTO_BUCKET)
          .getPublicUrl(uploadedPath).data.publicUrl;
      }

      const updatedAt = new Date().toISOString();
      const payload = {
        baby_name: nullableText(form.baby_name),
        mother_name: nullableText(form.mother_name),
        father_name: nullableText(form.father_name),
        birth_date: form.birth_date || null,
        birth_time: form.birth_time || null,
        birth_weight: form.birth_weight.trim() || null,
        birth_length: form.birth_length.trim() || null,
        welcome_title_en: nullableText(form.welcome_title_en),
        welcome_title_ar: nullableText(form.welcome_title_ar),
        welcome_message_en: nullableText(form.welcome_message_en),
        welcome_message_ar: nullableText(form.welcome_message_ar),
        baby_photo_url: nextPhotoUrl,
        theme: form.theme,
        allow_visitor_theme_change: form.allow_visitor_theme_change,
        guestbook_open: form.guestbook_open,
        updated_at: updatedAt,
      };
      const { data, error } = await supabase
        .from('site_settings')
        .update(payload)
        .eq('id', 1)
        .select(SITE_SETTINGS_COLUMNS)
        .single();
      if (error) throw error;
      if (!data) throw new Error('The saved site settings were not returned.');
      savedSettings = data;

      let cleanupWarning = false;
      if (uploadedPath && settings.baby_photo_url && settings.baby_photo_url !== nextPhotoUrl) {
        try {
          const oldPath = getStoragePath(settings.baby_photo_url, PHOTO_BUCKET);
          const { error: removeError } = await supabase.storage.from(PHOTO_BUCKET).remove([oldPath]);
          if (removeError && !isMissingStorageObject(removeError)) throw removeError;
        } catch (cleanupError) {
          console.error('The previous featured photo could not be removed.', cleanupError);
          cleanupWarning = true;
        }
      }

      onSaved(savedSettings);
      setForm(getFormValues(savedSettings));
      setPhotoFile(null);
      setPhotoPreviewUrl(null);
      setPhotoFailed(false);
      setSuccess(true);
      setPhotoCleanupWarning(cleanupWarning);
    } catch (error) {
      console.error('Could not save site settings.', error);
      if (uploadAttempted && uploadedPath && !savedSettings) {
        try {
          const { error: rollbackError } = await supabase.storage
            .from(PHOTO_BUCKET)
            .remove([uploadedPath]);
          rollbackFailed = Boolean(rollbackError && !isMissingStorageObject(rollbackError));
          if (rollbackFailed) {
            console.error('The new featured photo could not be removed after the settings save failed.', rollbackError);
          }
        } catch (rollbackError) {
          rollbackFailed = true;
          console.error('The new featured photo could not be removed after the settings save failed.', rollbackError);
        }
      }
      setErrorKey(rollbackFailed ? 'admin.settingsSaveRollbackError' : 'admin.settingsSaveError');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-settings">
      {errorKey && (
        <p className="admin-feedback is-error" role="alert" aria-live="assertive">{t(errorKey)}</p>
      )}
      {photoCleanupWarning && (
        <p className="admin-feedback is-error" role="alert" aria-live="assertive">
          {t('admin.settingsPhotoCleanupWarning')}
        </p>
      )}
      {success && (
        <p className="admin-feedback is-success" role="status" aria-live="polite">
          {t('admin.settingsSaved')}
        </p>
      )}

      <form className="admin-settings-form" onSubmit={handleSave}>
        <div className="admin-settings-layout">
          <div className="admin-settings-fields">
            <PaperCard className="admin-settings-section">
              <h2>{t('admin.settingsFamilyHeading')}</h2>
              <div className="admin-settings-grid">
                <label className="admin-settings-field">
                  <span>{t('admin.settingsBabyName')}</span>
                  <input name="baby_name" value={form.baby_name} onChange={updateField} />
                </label>
                <label className="admin-settings-field">
                  <span>{t('admin.settingsMotherName')}</span>
                  <input name="mother_name" value={form.mother_name} onChange={updateField} />
                </label>
                <label className="admin-settings-field">
                  <span>{t('admin.settingsFatherName')}</span>
                  <input name="father_name" value={form.father_name} onChange={updateField} />
                </label>
              </div>
            </PaperCard>

            <PaperCard className="admin-settings-section">
              <h2>{t('admin.settingsBirthHeading')}</h2>
              <div className="admin-settings-grid">
                <label className="admin-settings-field">
                  <span>{t('admin.settingsBirthDate')}</span>
                  <input name="birth_date" type="date" dir="ltr" value={form.birth_date} onChange={updateField} />
                </label>
                <label className="admin-settings-field">
                  <span>{t('admin.settingsBirthTime')}</span>
                  <input name="birth_time" type="time" dir="ltr" value={form.birth_time} onChange={updateField} />
                </label>
                <label className="admin-settings-field">
                  <span>{t('admin.settingsBirthWeight')}</span>
                  <input
                    name="birth_weight"
                    type="number"
                    step="any"
                    value={form.birth_weight}
                    onChange={updateField}
                    aria-invalid={Boolean(validationErrors.birth_weight)}
                    aria-describedby={validationErrors.birth_weight ? 'admin-weight-error' : undefined}
                  />
                  {validationErrors.birth_weight && (
                    <span id="admin-weight-error" className="admin-field-error">{t(validationErrors.birth_weight)}</span>
                  )}
                </label>
                <label className="admin-settings-field">
                  <span>{t('admin.settingsBirthLength')}</span>
                  <input
                    name="birth_length"
                    type="number"
                    step="any"
                    value={form.birth_length}
                    onChange={updateField}
                    aria-invalid={Boolean(validationErrors.birth_length)}
                    aria-describedby={validationErrors.birth_length ? 'admin-length-error' : undefined}
                  />
                  {validationErrors.birth_length && (
                    <span id="admin-length-error" className="admin-field-error">{t(validationErrors.birth_length)}</span>
                  )}
                </label>
              </div>
            </PaperCard>

            <PaperCard className="admin-settings-section">
              <h2>{t('admin.settingsWelcomeHeading')}</h2>
              <div className="admin-settings-grid">
                <label className="admin-settings-field">
                  <span>{t('admin.settingsWelcomeTitleEn')}</span>
                  <input name="welcome_title_en" value={form.welcome_title_en} onChange={updateField} lang="en" />
                </label>
                <label className="admin-settings-field">
                  <span>{t('admin.settingsWelcomeTitleAr')}</span>
                  <input name="welcome_title_ar" value={form.welcome_title_ar} onChange={updateField} lang="ar" />
                </label>
                <label className="admin-settings-field admin-settings-field--wide">
                  <span>{t('admin.settingsWelcomeMessageEn')}</span>
                  <textarea name="welcome_message_en" rows="3" value={form.welcome_message_en} onChange={updateField} lang="en" />
                </label>
                <label className="admin-settings-field admin-settings-field--wide">
                  <span>{t('admin.settingsWelcomeMessageAr')}</span>
                  <textarea name="welcome_message_ar" rows="3" value={form.welcome_message_ar} onChange={updateField} lang="ar" />
                </label>
              </div>
            </PaperCard>

            <PaperCard className="admin-settings-section">
              <h2>{t('admin.settingsPhotoHeading')}</h2>
              <div className="admin-featured-photo-control">
                <PolaroidFrame
                  src={previewPhoto && !photoFailed ? previewPhoto : null}
                  alt={t('hero.welcomePhoto', { name: previewName })}
                  caption={previewName}
                  loading="eager"
                  onError={() => setPhotoFailed(true)}
                >
                  <ScrapbookIcon name="cloud" size={38} />
                </PolaroidFrame>
                <div className="admin-featured-photo-input">
                  <label htmlFor="admin-featured-photo">
                    {t('admin.settingsChoosePhoto')}
                  </label>
                  <input
                    id="admin-featured-photo"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handlePhotoChange}
                    aria-invalid={Boolean(photoErrorKey)}
                    aria-describedby={photoErrorKey ? 'admin-featured-photo-error' : undefined}
                  />
                  {photoFile && <span>{photoFile.name}</span>}
                  <p>{t('admin.settingsPhotoHelp')}</p>
                  {photoErrorKey && (
                    <p id="admin-featured-photo-error" className="admin-field-error" role="alert">
                      {t(photoErrorKey)}
                    </p>
                  )}
                </div>
              </div>
            </PaperCard>

            <PaperCard className="admin-settings-section">
              <h2>{t('admin.settingsThemeHeading')}</h2>
              <fieldset className="admin-theme-picker">
                <legend>{t('admin.settingsThemeLabel')}</legend>
                <div className="admin-theme-options">
                  {Object.keys(themes).map((theme) => (
                    <label className="admin-theme-option" key={theme}>
                      <input
                        type="radio"
                        name="theme"
                        value={theme}
                        checked={form.theme === theme}
                        onChange={updateField}
                      />
                      <span>{t(`themeTypes.${theme}`)}</span>
                    </label>
                  ))}
                </div>
                {validationErrors.theme && (
                  <p className="admin-field-error">{t(validationErrors.theme)}</p>
                )}
              </fieldset>
              <div className="admin-theme-preview" style={themeStyle} data-theme={form.theme}>
                <div className="admin-theme-preview-copy">
                  <ScrapbookLabel>{t('admin.settingsPreviewLabel')}</ScrapbookLabel>
                  <h3>{previewName}</h3>
                  <p>{previewTitle || t('hero.defaultTitle')}</p>
                  <span>{previewMessage || t('hero.defaultMessage')}</span>
                </div>
                <ScrapbookIcon
                  className="admin-theme-preview-icon"
                  name={form.theme === 'girl' ? 'bow' : form.theme === 'royal' ? 'crown' : 'cloud'}
                  size={38}
                />
              </div>
              <label className="admin-settings-switch">
                <input
                  type="checkbox"
                  name="allow_visitor_theme_change"
                  checked={form.allow_visitor_theme_change}
                  onChange={updateField}
                />
                <span>{t('admin.settingsAllowVisitorTheme')}</span>
              </label>
            </PaperCard>

            <PaperCard className="admin-settings-section">
              <h2>{t('admin.settingsGuestbookHeading')}</h2>
              <label className="admin-settings-switch">
                <input
                  type="checkbox"
                  name="guestbook_open"
                  checked={form.guestbook_open}
                  onChange={updateField}
                />
                <span>{t('admin.settingsGuestbookOpen')}</span>
              </label>
              {!form.guestbook_open && (
                <p className="admin-settings-note">{t('admin.settingsGuestbookClosedNote')}</p>
              )}
            </PaperCard>
          </div>

          <PaperCard className="admin-theme-live-preview" style={themeStyle} data-theme={form.theme}>
            <ScrapbookLabel>{t('admin.settingsLivePreview')}</ScrapbookLabel>
            <div className="admin-theme-live-photo">
              <PolaroidFrame
                src={previewPhoto && !photoFailed ? previewPhoto : null}
                alt={t('hero.welcomePhoto', { name: previewName })}
                caption={previewName}
                loading="eager"
                onError={() => setPhotoFailed(true)}
              >
                <ScrapbookIcon
                  name={form.theme === 'girl' ? 'heart' : form.theme === 'royal' ? 'crown' : 'cloud'}
                  size={48}
                />
              </PolaroidFrame>
            </div>
            <h2>{previewName}</h2>
            <p>{previewTitle || t('hero.defaultTitle')}</p>
            <p>{previewMessage || t('hero.defaultMessage')}</p>
            <ScrapbookLabel className="admin-theme-live-name">{t(`themeTypes.${form.theme}`)}</ScrapbookLabel>
          </PaperCard>
        </div>

        <div className="admin-settings-footer">
          {lastSaved && (
            <p>
              <span>{t('admin.settingsLastSavedLabel')}</span>
              <time dateTime={settings.updated_at}>{lastSaved}</time>
            </p>
          )}
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? <Loader2 className="admin-access-spinner" size={18} aria-hidden="true" /> : null}
            {saving ? t('admin.settingsSaving') : t('admin.settingsSave')}
          </button>
        </div>
      </form>
    </div>
  );
}
