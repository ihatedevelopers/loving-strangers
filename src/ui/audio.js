// Music + tiny hand-made sound effects.
// Music: a licensed file at media/audio/loving-strangers.mp3 wins. Until Pedro has the licence,
// the draft streams the song through YouTube's embedded player instead of hosting a copy.

const SONG_FILE = 'media/audio/loving-strangers.mp3';
const YT_ID = '_nu-fvcdQt4';

export function createAudio() {
  let ctx = null;
  let musicOn = false;
  let player = null; // { play, pause, setVolume }
  const listeners = new Set();
  const emit = () => listeners.forEach((fn) => fn(musicOn));

  const ac = () => {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };

  // ---------- music source ----------
  // Each source reports real playback through onPlaying, so the UI never shows music that is not there.
  const onPlaying = (playing) => { if (musicOn !== playing) { musicOn = playing; emit(); } };

  const fileSource = () => fetch(SONG_FILE, { method: 'HEAD' }).then((r) => {
    if (!r.ok || !(r.headers.get('content-type') || '').includes('audio')) throw new Error('no file');
    const el = new Audio(SONG_FILE);
    el.loop = true;
    el.preload = 'auto';
    el.addEventListener('playing', () => onPlaying(true));
    el.addEventListener('pause', () => onPlaying(false));
    return { play: () => el.play(), pause: () => el.pause(), setVolume: (v) => { el.volume = v; } };
  });

  const youtubeSource = () => new Promise((resolve, reject) => {
    const host = document.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText = 'position:fixed;left:-400px;bottom:0;width:240px;height:240px;opacity:0;pointer-events:none;';
    const slot = document.createElement('div');
    host.appendChild(slot);
    document.body.appendChild(host);
    const make = () => {
      const yt = new window.YT.Player(slot, {
        width: 240, height: 240, videoId: YT_ID, host: 'https://www.youtube-nocookie.com',
        playerVars: { controls: 0, disablekb: 1, loop: 1, playlist: YT_ID, playsinline: 1, rel: 0 },
        events: {
          onReady: () => {
            yt.getIframe().tabIndex = -1;
            resolve({ play: () => yt.playVideo(), pause: () => yt.pauseVideo(), setVolume: (v) => yt.setVolume(Math.round(v * 100)) });
          },
          onStateChange: (e) => onPlaying(e.data === window.YT.PlayerState.PLAYING || e.data === window.YT.PlayerState.BUFFERING),
          onError: reject,
        },
      });
    };
    if (window.YT?.Player) make();
    else {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { prev?.(); make(); };
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.onerror = reject;
      document.head.appendChild(s);
    }
    setTimeout(() => reject(new Error('youtube timeout')), 12000);
  });

  // nothing third-party loads until the visitor reaches for the music
  const hasFile = fileSource().catch(() => null);
  let ready = null;
  const prime = () => {
    ready ??= hasFile.then((f) => f || youtubeSource()).then((p) => (player = p)).catch((e) => {
      console.warn('music unavailable', e);
      return null;
    });
    return ready;
  };

  let fadeRaf = 0;
  const fadeTo = (target, ms = 2400) => {
    cancelAnimationFrame(fadeRaf);
    const from = fadeTo.v ?? 0;
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / ms);
      fadeTo.v = from + (target - from) * k;
      player?.setVolume(fadeTo.v);
      if (k < 1) fadeRaf = requestAnimationFrame(step);
      else if (target === 0) player?.pause();
    };
    fadeRaf = requestAnimationFrame(step);
  };

  // resolves true once sound is really coming out, false if the browser blocked it
  async function play() {
    ac();
    const p = player || (await prime());
    if (!p) return false;
    p.setVolume(fadeTo.v ?? 0);
    try { await p.play(); } catch { return false; }
    fadeTo(0.8);
    if (musicOn) return true;
    return new Promise((res) => {
      const done = (on) => { listeners.delete(done); clearTimeout(t); res(on); };
      const t = setTimeout(() => done(false), 3500);
      listeners.add(done);
    });
  }
  function pause() {
    fadeTo(0, 900);
    setTimeout(() => onPlaying(false), 950);
  }

  // ---------- effects: all synthesised, no files ----------
  function noise(duration, { type = 'bandpass', freq = 2000, q = 0.8, gain = 0.3, attack = 0.005 } = {}) {
    const c = ac();
    const len = Math.floor(c.sampleRate * duration);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 1.6;
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0, c.currentTime);
    g.gain.linearRampToValueAtTime(gain, c.currentTime + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);
    src.connect(f).connect(g).connect(c.destination);
    src.start();
  }

  const sfx = {
    tear() {
      // paper: a run of tiny crackles
      for (let i = 0; i < 9; i++) setTimeout(() => noise(0.05 + Math.random() * 0.05, { freq: 2600 + Math.random() * 2400, q: 1.4, gain: 0.22 }), i * 28 + Math.random() * 20);
      noise(0.35, { type: 'highpass', freq: 1800, gain: 0.12 });
    },
    shutter() {
      noise(0.04, { freq: 4200, q: 2, gain: 0.5 });
      setTimeout(() => noise(0.08, { freq: 1600, q: 1, gain: 0.35 }), 70);
    },
    strum() {
      const c = ac();
      // a soft G major 7 on a plucked string
      [196, 246.9, 293.7, 370, 392].forEach((f, i) => {
        const t = c.currentTime + i * 0.055;
        const o = c.createOscillator();
        const g = c.createGain();
        const lp = c.createBiquadFilter();
        o.type = 'triangle'; o.frequency.value = f;
        lp.type = 'lowpass'; lp.frequency.setValueAtTime(3200, t); lp.frequency.exponentialRampToValueAtTime(400, t + 1.4);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.09, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
        o.connect(lp).connect(g).connect(c.destination);
        o.start(t); o.stop(t + 2.3);
      });
    },
    mrrp() {
      const c = ac();
      const t = c.currentTime;
      const o = c.createOscillator();
      const g = c.createGain();
      const f = c.createBiquadFilter();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(420, t);
      o.frequency.linearRampToValueAtTime(640, t + 0.12);
      o.frequency.linearRampToValueAtTime(520, t + 0.26);
      f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 3;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.12, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
      o.connect(f).connect(g).connect(c.destination);
      o.start(t); o.stop(t + 0.34);
    },
  };

  return {
    play, pause, prime,
    toggle: () => (musicOn ? pause() : play()),
    get on() { return musicOn; },
    onChange: (fn) => listeners.add(fn),
    sfx,
  };
}
