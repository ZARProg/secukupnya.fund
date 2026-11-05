// Dijalankan sebelum halaman digambar supaya tidak berkedip terang saat tema gelap. Berkas terpisah karena CSP melarang skrip inline.
(function () {
  try {
    var m = localStorage.getItem('budgettracker.theme.v1');
    var dark = m === 'dark' || (m !== 'light' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#0E1511' : '#1E4D3A');
  } catch (e) { /* tetap tema terang */ }
})();
