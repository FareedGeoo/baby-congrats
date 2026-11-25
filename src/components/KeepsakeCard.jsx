import { PaperCard, PaperClip, ScrapbookLabel, ScrapbookSticker, WashiTape } from './ScrapbookComponents.jsx';
import { useI18n } from '../i18n/index.js';
import { formatSiteDate, formatSiteTime } from '../utils/formatSiteValue.js';

function formattedNumber(value, language, unit) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  return `${new Intl.NumberFormat(language, { maximumFractionDigits: 2 }).format(number)} ${unit}`;
}

export function KeepsakeCard({ settings }) {
  const { language, t } = useI18n();
  const fields = [
    [t('keepsake.name'), settings.baby_name],
    [t('keepsake.birthDate'), formatSiteDate(settings.birth_date, language)],
    [t('keepsake.birthTime'), formatSiteTime(settings.birth_time, language)],
    [t('keepsake.birthWeight'), formattedNumber(settings.birth_weight, language, t('keepsake.weightUnit'))],
    [t('keepsake.birthLength'), formattedNumber(settings.birth_length, language, t('keepsake.lengthUnit'))],
    [t('keepsake.mother'), settings.mother_name],
    [t('keepsake.father'), settings.father_name],
  ].filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '');

  if (fields.length === 0) return null;

  return (
    <section className="keepsake-section" aria-labelledby="keepsake-title">
      <PaperCard className="keepsake-card">
        <WashiTape />
        <PaperClip />
        <div className="keepsake-heading">
          <div>
            <ScrapbookLabel>{t('keepsake.title')}</ScrapbookLabel>
            <h2 id="keepsake-title">{t('keepsake.subtitle')}</h2>
          </div>
          {settings.baby_name && <ScrapbookSticker icon="star">{settings.baby_name}</ScrapbookSticker>}
        </div>
        <dl className="keepsake-details">
          {fields.map(([label, value]) => (
            <div className="keepsake-detail" key={label}>
              <dt>{label}</dt>
              <dd dir="auto">{value}</dd>
            </div>
          ))}
        </dl>
      </PaperCard>
    </section>
  );
}
