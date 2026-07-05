// Applies chrome.i18n translations to static HTML.
// Chrome picks the locale automatically from the browser language, falling back
// to default_locale (en) when the browser's language isn't one of the
// supported ones. Elements opt in via data attributes:
//   data-i18n="key"       → sets textContent
//   data-i18n-html="key"  → sets innerHTML (for messages containing markup)
// The document title comes from the <html data-i18n-title="key"> attribute.
(() => {
  // Must match the languages under _locales/. Keep in sync when adding one.
  const SUPPORTED_LANGS = ['en', 'it', 'es', 'fr', 'de', 'pl', 'pt'];
  const DEFAULT_LANG = 'en';

  const t = (k) => chrome.i18n.getMessage(k);

  for (const el of document.querySelectorAll('[data-i18n]')) {
    const msg = t(el.dataset.i18n);
    if (msg) el.textContent = msg;
  }
  for (const el of document.querySelectorAll('[data-i18n-html]')) {
    const msg = t(el.dataset.i18nHtml);
    if (msg) el.innerHTML = msg;
  }

  const titleKey = document.documentElement.getAttribute('data-i18n-title');
  if (titleKey) {
    const msg = t(titleKey);
    if (msg) document.title = msg;
  }

  // Keep the <html lang> in sync with the language Chrome actually used for
  // the messages above. getUILanguage() reflects the raw browser language,
  // which may not be one of our locales — in that case chrome.i18n silently
  // falls back to default_locale (en), so lang must fall back to it too.
  const browserLang = (chrome.i18n.getUILanguage() || DEFAULT_LANG).split('-')[0];
  document.documentElement.lang = SUPPORTED_LANGS.includes(browserLang) ? browserLang : DEFAULT_LANG;
})();
