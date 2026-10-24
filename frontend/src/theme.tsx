import { useState } from 'react';
export function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('clausecheck-theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch { /* Theme switching still works if browser storage is disabled. */ }
    return 'light';
  });
  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    try { localStorage.setItem('clausecheck-theme', next); } catch { /* Optional preference only. */ }
  };
  return [theme, toggleTheme] as const;
}
export function ThemeSwitch({theme, toggleTheme}: {theme: 'light' | 'dark'; toggleTheme: () => void}) {
 return ( <button type="button" className="theme-switch" role="switch" aria-checked={theme === 'dark'}
  aria-label="Dark theme" title={theme === 'light' ? 'Switch to Dusk dark theme' : 'Switch to Lavender light theme'} onClick={toggleTheme}>
  <span className="theme-switch-thumb">
   {theme === 'light' ? (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
   ) : (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z"/></svg>
   )}
  </span>
 </button>);
}
