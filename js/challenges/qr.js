// QR challenge: open the rear camera and scan the code generated in Settings.
// Uses the native BarcodeDetector when available, otherwise the vendored jsQR.

import { getQrSecret } from '../storage.js';

export const QR_PREFIX = 'wakeup:';

let stream = null;
let rafId = null;
let stopped = false;

async function makeDetector() {
  if ('BarcodeDetector' in window) {
    try {
      const formats = await window.BarcodeDetector.getSupportedFormats();
      if (formats.includes('qr_code')) {
        const det = new window.BarcodeDetector({ formats: ['qr_code'] });
        return async (video) => {
          const codes = await det.detect(video);
          return codes.length ? codes[0].rawValue : null;
        };
      }
    } catch { /* fall through to jsQR */ }
  }
  if (typeof window.jsQR !== 'function') return null;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  return async (video) => {
    const scale = Math.min(1, 480 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = window.jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
    return code ? code.data : null;
  };
}

function stopCamera() {
  stopped = true;
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
}

export const qr = {
  id: 'qr',
  label: 'QR scan',

  async mount(container, settings, { onPass, onActivity }) {
    const secret = getQrSecret();
    stopped = false;

    container.innerHTML = `
      <div class="challenge-title">Scan your wake-up QR code</div>
      <div class="qr-video-wrap"><video data-video playsinline muted autoplay></video></div>
      <div class="qr-status" data-status>Starting camera…</div>
    `;
    const video = container.querySelector('[data-video]');
    const status = container.querySelector('[data-status]');

    if (!secret) {
      status.textContent = 'No QR code set up yet. Go to Settings → QR code first.';
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      status.textContent = 'Camera not available. This page must be opened over HTTPS (or localhost).';
      return;
    }

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
    } catch (err) {
      status.textContent = err.name === 'NotFoundError'
        ? 'No camera found on this device.'
        : `Camera blocked (${err.name}). Allow camera access for this site and try again.`;
      return;
    }
    if (stopped) { stopCamera(); return; }

    video.srcObject = stream;
    try { await video.play(); } catch { /* autoplay attr handles it */ }

    const detect = await makeDetector();
    if (!detect) {
      status.textContent = 'No QR decoder available in this browser.';
      return;
    }
    status.textContent = 'Point the camera at the code';

    let lastScan = 0;
    const loop = async (t) => {
      if (stopped) return;
      // ~8 scans per second is plenty and keeps the phone cool.
      if (t - lastScan > 120 && video.readyState >= 2) {
        lastScan = t;
        try {
          const value = await detect(video);
          if (value) {
            if (value === QR_PREFIX + secret) {
              status.textContent = 'Code accepted ✔';
              stopCamera();
              onPass();
              return;
            }
            status.textContent = 'That is a different code';
            onActivity();
          }
        } catch { /* detector hiccup on a frame; keep going */ }
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
  },

  unmount() {
    stopCamera();
  },
};
