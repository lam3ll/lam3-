export type ThemeMode = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'runway-theme-mode';

export function getInitialTheme(): ThemeMode {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') {
      return saved;
    }
  } catch {
    // Ignore storage read errors
  }
  return 'light';
}

export function applyTheme(theme: ThemeMode): void {
  const isDark = theme === 'dark';
  const root = document.documentElement;
  root.classList.toggle('dark', isDark);
  root.dataset.theme = theme;
  root.style.colorScheme = theme;

  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', isDark ? '#121212' : '#ffffff');
  }

  const toggleBtn = document.getElementById('theme-toggle');
  if (toggleBtn) {
    toggleBtn.setAttribute('aria-pressed', String(isDark));
    toggleBtn.setAttribute(
      'aria-label',
      isDark ? 'Switch to light theme' : 'Switch to dark theme'
    );
    const label = toggleBtn.querySelector<HTMLElement>('[data-theme-label]');
    if (label) {
      label.textContent = isDark ? 'Light' : 'Dark';
    }
  }

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore storage write errors
  }
}

export function initThemeToggle(): () => void {
  let current = getInitialTheme();
  applyTheme(current);

  const toggleBtn = document.getElementById('theme-toggle');
  const onToggle = () => {
    current = current === 'dark' ? 'light' : 'dark';
    applyTheme(current);
  };

  toggleBtn?.addEventListener('click', onToggle);
  return () => {
    toggleBtn?.removeEventListener('click', onToggle);
  };
}
