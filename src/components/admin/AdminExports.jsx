import { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, Loader2, Printer } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { useI18n } from '../../i18n/index.js';
import { themes } from '../../themes/index.js';
import { isMissingStorageObject, getStoragePath } from '../../utils/storage.js';
import { PaperCard, ScrapbookLabel } from '../ScrapbookComponents.jsx';

const PHOTO_BUCKET = 'baby-photos';

function csvCell(value) {
  const text = String(value ?? '');
  const protectedText = /^[\s\u0000-\u001f]*[=+\-@]/.test(text)
    ? `'${text}`
    : text;
  return `"${protectedText.replace(/"/g, '""')}"`;
}

function saveBlob(blob, filename) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

function safeFilenamePart(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function getArchiveFilename(index, photo, storagePath) {
  const extension = storagePath.split('/').pop()?.split('.').pop()?.replace(/[^a-z0-9]/gi, '') || 'jpg';
  const sender = safeFilenamePart(photo.sender);
  return `${String(index + 1).padStart(3, '0')}-${sender || 'baby-photo'}.${extension}`;
}

export function AdminExports({ messages, babyName, featuredPhotoUrl, themeName }) {
  const { t } = useI18n();
  const [zipProgress, setZipProgress] = useState(null);
  const [zipResult, setZipResult] = useState(null);
  const [zipBusy, setZipBusy] = useState(false);
  const themeStyle = themes[themeName]?.cssVariables || themes.boy.cssVariables;

  const photos = useMemo(() => {
    const seenUrls = new Set();
    const allPhotos = [];
    if (featuredPhotoUrl) {
      seenUrls.add(featuredPhotoUrl);
      allPhotos.push({
        photo_url: featuredPhotoUrl,
        sender: babyName || t('admin.featuredPhoto'),
      });
    }
    messages.forEach((message) => {
      if (!message.photo_url || seenUrls.has(message.photo_url)) return;
      seenUrls.add(message.photo_url);
      allPhotos.push({
        photo_url: message.photo_url,
        sender: message.name || t('admin.unknownSender'),
      });
    });
    return allPhotos;
  }, [babyName, featuredPhotoUrl, messages, t]);

  function downloadCsv() {
    const headers = [
      t('admin.csvId'),
      t('admin.csvSender'),
      t('admin.csvMessage'),
      t('admin.csvRecipient'),
      t('admin.csvDate'),
      t('admin.csvApproval'),
      t('admin.csvPinned'),
      t('admin.csvPhotoUrl'),
    ];
    const rows = messages.map((message) => [
      message.id,
      message.name,
      message.message,
      t(message.recipient_type === 'parents' ? 'guestbook.parents' : 'guestbook.baby'),
      message.created_at,
      t(message.approved ? 'admin.approved' : 'admin.pending'),
      t(message.pinned ? 'admin.yes' : 'admin.no'),
      message.photo_url,
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map(csvCell).join(','))
      .join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    saveBlob(blob, t('admin.csvFilename'));
  }

  async function downloadPhotoArchive() {
    if (zipBusy) return;
    if (photos.length === 0) {
      setZipResult({ type: 'empty', missing: [], failed: [] });
      return;
    }

    setZipBusy(true);
    setZipResult(null);
    setZipProgress({ phase: 'fetch', current: 0, total: photos.length, percent: 0 });
    const missing = [];
    const failed = [];
    let downloadedCount = 0;

    try {
      const { default: JSZip } = await import('jszip');
      const archive = new JSZip();
      for (let index = 0; index < photos.length; index += 1) {
        const photo = photos[index];
        setZipProgress({
          phase: 'fetch',
          current: index + 1,
          total: photos.length,
          percent: Math.round((index / photos.length) * 70),
        });

        try {
          const storagePath = getStoragePath(photo.photo_url, PHOTO_BUCKET);
          const { data, error } = await supabase.storage.from(PHOTO_BUCKET).download(storagePath);
          if (error) {
            if (isMissingStorageObject(error)) {
              missing.push({ name: photo.sender, number: index + 1 });
            } else {
              throw error;
            }
          } else {
            if (!(data instanceof Blob)) throw new Error('Photo download did not return a file.');
            archive.file(getArchiveFilename(index, photo, storagePath), data);
            downloadedCount += 1;
          }
        } catch (error) {
          console.error('Could not add a photo to the memory archive.', error);
          failed.push({ name: photo.sender, number: index + 1 });
        }

        setZipProgress({
          phase: 'fetch',
          current: index + 1,
          total: photos.length,
          percent: Math.round(((index + 1) / photos.length) * 70),
        });
      }

      if (downloadedCount === 0) {
        setZipResult({ type: 'none-downloaded', missing, failed });
        return;
      }

      setZipProgress({
        phase: 'archive',
        current: downloadedCount,
        total: downloadedCount,
        percent: 70,
      });
      const archiveBlob = await archive.generateAsync(
        { type: 'blob' },
        ({ percent }) => {
          setZipProgress({
            phase: 'archive',
            current: downloadedCount,
            total: downloadedCount,
            percent: 70 + Math.round(percent * 0.3),
          });
        },
      );
      saveBlob(archiveBlob, t('admin.photosArchiveFilename'));
      setZipResult({
        type: missing.length || failed.length ? 'partial' : 'success',
        downloaded: downloadedCount,
        missing,
        failed,
      });
    } catch (error) {
      console.error('Could not create the memory photo archive.', error);
      setZipResult({ type: 'archive-error', missing, failed });
    } finally {
      setZipBusy(false);
    }
  }

  const zipResultKey = zipResult?.type === 'empty'
    ? 'admin.zipNoPhotos'
    : zipResult?.type === 'none-downloaded'
      ? 'admin.zipNoPhotosDownloaded'
      : zipResult?.type === 'archive-error'
        ? 'admin.zipArchiveError'
        : zipResult?.type === 'partial'
          ? 'admin.zipPartial'
          : zipResult?.type === 'success'
            ? 'admin.zipSuccess'
            : '';

  return (
    <div className="admin-export-tools" style={themeStyle}>
      <header className="admin-export-heading">
        <h2>{t('admin.exportHeading')}</h2>
        <p>{t('admin.exportDescription')}</p>
      </header>

      <div className="admin-export-grid">
        <PaperCard className="admin-export-card">
          <ScrapbookLabel>{t('admin.exportPrintLabel')}</ScrapbookLabel>
          <h3>{t('admin.exportPrintTitle')}</h3>
          <p>{t('admin.exportPrintDescription')}</p>
          <Link className="btn-outline admin-export-action" to="/admin/print">
            <Printer size={18} aria-hidden="true" />
            {t('admin.openPrintBook')}
          </Link>
        </PaperCard>

        <PaperCard className="admin-export-card">
          <ScrapbookLabel>{t('admin.exportCsvLabel')}</ScrapbookLabel>
          <h3>{t('admin.exportCsvTitle')}</h3>
          <p>{t('admin.exportCsvDescription')}</p>
          <button type="button" className="btn-outline admin-export-action" onClick={downloadCsv}>
            <FileSpreadsheet size={18} aria-hidden="true" />
            {t('admin.downloadCsv')}
          </button>
        </PaperCard>

        <PaperCard className="admin-export-card">
          <ScrapbookLabel>{t('admin.exportPhotosLabel')}</ScrapbookLabel>
          <h3>{t('admin.exportPhotosTitle')}</h3>
          <p>{t('admin.exportPhotosDescription')}</p>
          <button
            type="button"
            className="btn-outline admin-export-action"
            onClick={downloadPhotoArchive}
            disabled={zipBusy}
          >
            {zipBusy
              ? <Loader2 className="admin-access-spinner" size={18} aria-hidden="true" />
              : <Download size={18} aria-hidden="true" />}
            {zipBusy ? t('admin.zipPreparing') : t('admin.downloadAllPhotos')}
          </button>
        </PaperCard>
      </div>

      {zipBusy && zipProgress && (
        <div className="admin-zip-progress" role="status" aria-live="polite">
          <p>
            {zipProgress.phase === 'fetch'
              ? t('admin.zipFetchProgress', {
                current: zipProgress.current,
                total: zipProgress.total,
              })
              : t('admin.zipArchiveProgress')}
          </p>
          <progress
            max="100"
            value={zipProgress.percent}
            aria-label={t('admin.zipProgressLabel')}
          />
        </div>
      )}

      {zipResult && (
        <div
          className={`admin-zip-result ${zipResult.type === 'success' ? 'is-success' : 'is-error'}`}
          role={zipResult.type === 'success' ? 'status' : 'alert'}
          aria-live={zipResult.type === 'success' ? 'polite' : 'assertive'}
        >
          <p>
            {t(zipResultKey, {
              downloaded: zipResult.downloaded || 0,
              missing: zipResult.missing.length,
              failed: zipResult.failed.length,
            })}
          </p>
          {zipResult.missing.length > 0 && (
            <div>
              <h4>{t('admin.zipMissingHeading')}</h4>
              <ul>
                {zipResult.missing.map((photo) => (
                  <li key={`missing-${photo.number}`}>{t('admin.zipPhotoName', photo)}</li>
                ))}
              </ul>
            </div>
          )}
          {zipResult.failed.length > 0 && (
            <div>
              <h4>{t('admin.zipFailedHeading')}</h4>
              <ul>
                {zipResult.failed.map((photo) => (
                  <li key={`failed-${photo.number}`}>{t('admin.zipPhotoName', photo)}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
