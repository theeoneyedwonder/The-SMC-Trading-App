// Lightweight synthesised SFX for order fills, alerts, and errors.
// No audio assets — everything is generated with the Web Audio API, so it
// works offline in the packaged app. Master-enable + per-event volumes are
// persisted in localStorage and read live, so the Settings sliders take
// effect immediately with zero extra wiring.

const KEYS = {
  enabled:   'ui_sound_enabled',
  orderFill: 'ui_sound_order_fill',
  alert:     'ui_sound_alert',
  error:     'ui_sound_error',
};

export const SOUND_DEFAULTS = { enabled: true, orderFill: 80, alert: 100, error: 100 };

export function getSoundSettings() {
  const num = (k, d) => {
    const raw = localStorage.getItem(k);
    if (raw == null) return d;
    const v = Number(raw);
    return Number.isFinite(v) ? v : d;
  };
  const rawEnabled = localStorage.getItem(KEYS.enabled);
  return {
    enabled:   rawEnabled == null ? SOUND_DEFAULTS.enabled : rawEnabled === 'true',
    orderFill: num(KEYS.orderFill, SOUND_DEFAULTS.orderFill),
    alert:     num(KEYS.alert,     SOUND_DEFAULTS.alert),
    error:     num(KEYS.error,     SOUND_DEFAULTS.error),
  };
}

export function setSoundSetting(key, value) {
  if (!KEYS[key]) return;
  localStorage.setItem(KEYS[key], String(value));
}

let _ctx = null;
function audio() {
  if (!_ctx) {
    try { _ctx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch { _ctx = null; }
  }
  return _ctx;
}

// A short synthesised blip. freq/type shape the character per event; vol is 0..1.
function blip({ freq = 660, type = 'sine', dur = 0.14, vol = 1 }) {
  if (!getSoundSettings().enabled || vol <= 0) return;
  const ac = audio();
  if (!ac) return;
  if (ac.state === 'suspended') ac.resume();

  const osc  = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;

  const peak = 0.2 * vol; // keep it gentle even at max
  const t = ac.currentTime;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export function playOrderFill() { blip({ freq: 720, type: 'triangle', dur: 0.15, vol: getSoundSettings().orderFill / 100 }); }
export function playAlert()     { blip({ freq: 900, type: 'sine',     dur: 0.20, vol: getSoundSettings().alert     / 100 }); }
export function playError()     { blip({ freq: 190, type: 'sawtooth', dur: 0.28, vol: getSoundSettings().error     / 100 }); }

// Preview a single channel by key (used by the Settings sliders on release).
export function previewSound(key) {
  ({ orderFill: playOrderFill, alert: playAlert, error: playError }[key] || (() => {}))();
}

// "TEST ALL AUDIO" — play the three in sequence at their configured volumes.
export function testAllAudio() {
  playOrderFill();
  setTimeout(playAlert, 240);
  setTimeout(playError, 520);
}
