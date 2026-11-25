import { useEffect, useState } from 'react';
import { FALLBACK_SITE_SETTINGS } from '../config.js';
import { isTheme } from '../themes/index.js';
import { supabase } from '../lib/supabase.js';
import { SITE_SETTINGS_COLUMNS } from '../utils/siteSettings.js';

function normalizeSettings(data) {
  const settings = { ...FALLBACK_SITE_SETTINGS, ...data };

  return {
    ...settings,
    baby_name: data.baby_name?.trim() || null,
    theme: isTheme(data.theme) ? data.theme : FALLBACK_SITE_SETTINGS.theme,
    welcome_title_en: data.welcome_title_en?.trim() || FALLBACK_SITE_SETTINGS.welcome_title_en,
    welcome_title_ar: data.welcome_title_ar?.trim() || FALLBACK_SITE_SETTINGS.welcome_title_ar,
    welcome_message_en: data.welcome_message_en?.trim() || FALLBACK_SITE_SETTINGS.welcome_message_en,
    welcome_message_ar: data.welcome_message_ar?.trim() || FALLBACK_SITE_SETTINGS.welcome_message_ar,
    guestbook_open: typeof data.guestbook_open === 'boolean'
      ? data.guestbook_open
      : FALLBACK_SITE_SETTINGS.guestbook_open,
  };
}

export function useSiteSettings() {
  const [settings, setSettings] = useState(FALLBACK_SITE_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    let active = true;

    async function fetchSettings() {
      try {
        const { data, error } = await supabase
          .from('site_settings')
          .select(SITE_SETTINGS_COLUMNS)
          .eq('id', 1)
          .maybeSingle();

        if (error) throw error;
        if (!data) throw new Error('Public site settings row is missing.');
        if (active) setSettings(normalizeSettings(data));
      } catch (error) {
        console.error('Could not load site settings; using local defaults.', error);
        if (active) {
          setSettings(FALLBACK_SITE_SETTINGS);
          setUsingFallback(true);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchSettings();
    return () => {
      active = false;
    };
  }, []);

  return { settings, loading, usingFallback };
}
