const canvas = document.getElementById('qr');
const input = document.getElementById('url');
const errorEl = document.getElementById('error');
const statusEl = document.getElementById('status');
const copyBtn = document.getElementById('copy');
const downloadBtn = document.getElementById('download');

const SIZE = 240;   // canvas pixels
const QUIET = 4;    // quiet-zone modules (QR spec minimum)
const sizeKeys = [...document.querySelectorAll('#size .sz')];
const sizeReadout = document.getElementById('sizeReadout');
let exportSize = 800; // copied/downloaded image size in pixels
let currentQr = null;

function setSize(n) {
  exportSize = n;
  sizeKeys.forEach((k) => k.setAttribute('aria-checked', String(+k.dataset.size === n)));
  sizeReadout.textContent = n + ' px';
}

try {
  const saved = parseInt(localStorage.getItem('exportSize'), 10);
  if (sizeKeys.some((k) => +k.dataset.size === saved)) exportSize = saved;
} catch (e) { /* use default */ }
setSize(exportSize);
sizeKeys.forEach((k) => k.addEventListener('click', () => {
  setSize(+k.dataset.size);
  try { localStorage.setItem('exportSize', exportSize); } catch (e) { /* ignore */ }
}));

function say(msg) {
  statusEl.textContent = msg;
  if (msg) setTimeout(() => { if (statusEl.textContent === msg) statusEl.textContent = ''; }, 2000);
}

function render(text) {
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, SIZE, SIZE);
  errorEl.hidden = true;
  copyBtn.disabled = downloadBtn.disabled = !text;
  if (!text) return;

  let qr;
  try {
    qr = qrcode(0, 'M');           // type 0 = auto-size, error correction M
    qr.addData(text, 'Byte');
    qr.make();
  } catch (e) {
    errorEl.textContent = 'Too much text to fit in a QR code.';
    errorEl.hidden = false;
    copyBtn.disabled = downloadBtn.disabled = true;
    return;
  }

  currentQr = qr;
  draw(ctx, qr, SIZE);
}

function draw(ctx, qr, size) {
  const n = qr.getModuleCount();
  const cell = Math.floor(size / (n + QUIET * 2));
  const offset = Math.floor((size - cell * n) / 2);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#000';
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      if (qr.isDark(r, c)) ctx.fillRect(offset + c * cell, offset + r * cell, cell, cell);
}

// Exported image is rendered separately at full resolution.
function toBlob() {
  const out = document.createElement('canvas');
  out.width = out.height = exportSize;
  draw(out.getContext('2d'), currentQr, exportSize);
  return new Promise((resolve) => out.toBlob(resolve, 'image/png'));
}

copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': await toBlob() })]);
    say('Copied to clipboard');
  } catch (e) {
    say('Copy failed');
  }
});

downloadBtn.addEventListener('click', async () => {
  const url = URL.createObjectURL(await toBlob());
  const a = document.createElement('a');
  a.href = url;
  a.download = 'qrcode.png';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  say('Saved');
});

input.addEventListener('input', () => render(input.value.trim()));

(async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) input.value = tab.url;
  } catch (e) { /* leave empty */ }
  render(input.value.trim());
  input.focus();
  input.select();
})();
