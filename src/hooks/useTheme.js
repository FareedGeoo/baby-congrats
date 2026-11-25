import { useEffect, useState, useCallback } from 'react';
import { DEFAULT_THEME, isTheme, themes } from '../themes/index.js';

const THEME_ORDER = ['boy', 'girl', 'royal'];

export function useTheme({
  preferredTheme = DEFAULT_THEME,
  allowVisitorThemeChange = false,
  ready = true,
} = {}) {
  const [theme, setTheme] = useState(DEFAULT_THEME);
  const [mounted, setMounted] = useState(false);

  const applyTheme = useCallback((nextTheme) => {
    const themeConfig = themes[nextTheme];
    if (!themeConfig) {
      throw new RangeError(`Unknown theme: ${nextTheme}`);
    }

    const root = document.documentElement;
    root.dataset.theme = nextTheme;
    Object.entries(themeConfig.cssVariables).forEach(([name, value]) => {
      root.style.setProperty(name, value);
    });
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) {
      themeColor.setAttribute('content', themeConfig.themeColor);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;

    const urlParams = new URLSearchParams(window.location.search);
    const urlTheme = urlParams.get('theme');
    const storedTheme = localStorage.getItem('baby-congrats-theme');
    const visitorTheme = allowVisitorThemeChange && isTheme(urlTheme)
      ? urlTheme
      : allowVisitorThemeChange && isTheme(storedTheme)
        ? storedTheme
        : null;
    const nextTheme = visitorTheme || (isTheme(preferredTheme) ? preferredTheme : DEFAULT_THEME);

    setTheme(nextTheme);
    applyTheme(nextTheme);
    setMounted(true);
  }, [allowVisitorThemeChange, applyTheme, preferredTheme, ready]);

  const toggleTheme = useCallback(() => {
    const currentIndex = THEME_ORDER.indexOf(theme);
    const nextTheme = THEME_ORDER[(currentIndex + 1) % THEME_ORDER.length];
    setTheme(nextTheme);
    applyTheme(nextTheme);
    localStorage.setItem('baby-congrats-theme', nextTheme);
  }, [theme, applyTheme]);

  const selectTheme = useCallback((nextTheme) => {
    if (!isTheme(nextTheme)) {
      throw new RangeError(`Unknown theme: ${nextTheme}`);
    }
    setTheme(nextTheme);
    applyTheme(nextTheme);
    localStorage.setItem('baby-congrats-theme', nextTheme);
  }, [applyTheme]);

  return { theme, toggleTheme, selectTheme, mounted };
}