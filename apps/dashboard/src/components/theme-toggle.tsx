'use client';

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

export function ThemeToggle() {
  // Start undefined to avoid a server/client mismatch; the inline script already set the attribute.
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const current = document.documentElement.getAttribute('data-theme');
    setTheme(current === 'dark' ? 'dark' : 'light');
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('agentmesh-theme', next);
    } catch {
      // private mode: ignore
    }
    setTheme(next);
  };

  return (
    <button type="button" onClick={toggle} className="btn" aria-label="Toggle colour theme" title="Toggle theme">
      {theme === 'dark' ? 'Light' : 'Dark'}
    </button>
  );
}
