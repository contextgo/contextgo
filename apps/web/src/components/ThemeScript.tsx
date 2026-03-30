const themeScript = `
(() => {
  const storageKey = 'contextgo-theme';
  const root = document.documentElement;
  const stored = localStorage.getItem(storageKey);
  const mode = stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
  const resolved = mode === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : mode;
  root.dataset.themeMode = mode;
  root.dataset.theme = resolved;
})();
`;

export default function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: themeScript }} />;
}
