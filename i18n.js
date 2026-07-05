// Applies chrome.i18n translations to static HTML.
// Chrome picks the locale automatically from the browser language, falling back
// to default_locale (en). Elements opt in via data attributes:
//   data-i18n="key"       → sets textContent
//   data-i18n-html="key"  → sets innerHTML (for messages containing markup)
// The document title comes from the <html data-i18n-title="key"> attribute.
(() => {
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

  // Keep the <html lang> in sync with the active UI language.
  document.documentElement.lang = (chrome.i18n.getUILanguage() || 'en').split('-')[0];
})();
