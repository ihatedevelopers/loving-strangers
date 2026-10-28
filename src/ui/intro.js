import gsap from 'gsap';
import sunPaths from '../sun-paths.txt?raw';

// The logo's sun, drawn ray by ray. The last path is the spiral with the heart.
export function sunSVG() {
  const parts = sunPaths.trim().split('\n');
  const core = parts.pop().replace('class="ray"', 'class="core-path"');
  // each ray sits in its own group so animating it never overwrites the path's own placement
  const rays = parts.map((p) => `<g class="ray">${p.replace('class="ray" ', '')}</g>`).join('');
  return `<svg class="sun-svg" viewBox="0 0 875.4 875.9" aria-hidden="true"><g class="rays">${rays}</g><g class="core">${core}</g></svg>`;
}

export function initIntro({ audio, toast, onStart }) {
  const intro = document.getElementById('intro');
  const sunHost = intro.querySelector('[data-sun]');
  sunHost.innerHTML = sunSVG();
  const rays = sunHost.querySelectorAll('.ray');

  const tl = gsap.timeline({ delay: 0.2 });
  tl.fromTo(sunHost, { scale: 0, rotate: -120 }, { scale: 1, rotate: 0, duration: 1.4, ease: 'elastic.out(1, .6)' })
    .fromTo(rays, { opacity: 0 }, { opacity: 1, duration: 0.35, stagger: 0.06, ease: 'power1.out' }, 0.5)
    .fromTo('.intro__title > *', { yPercent: 60, opacity: 0, rotate: 4 }, { yPercent: 0, opacity: 1, rotate: 0, duration: 1, stagger: 0.12, ease: 'expo.out' }, 0.7)
    .fromTo('.intro__lede, .intro__play, .intro__silent, .intro__coords', { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, stagger: 0.08, ease: 'power3.out' }, 1.1);
  // the sun breathes while it waits
  let breathe = null;
  tl.add(() => { breathe = gsap.to(rays, { opacity: 0.45, duration: 1.4, stagger: { each: 0.12, repeat: -1, yoyo: true }, ease: 'sine.inOut' }); });

  // the page behind the dialog stays out of reach until the journey starts
  const behind = document.querySelectorAll('main, footer, [data-nav], .skip');
  behind.forEach((el) => { el.inert = true; });

  // fetch the music player only when someone reaches for it
  const playBtn = intro.querySelector('[data-start="sound"]');
  ['pointerenter', 'pointerdown', 'focus'].forEach((ev) => playBtn.addEventListener(ev, () => audio.prime(), { once: true }));

  let started = false;
  const start = async (withSound) => {
    if (started) return;
    started = true;
    if (withSound) audio.play().then((ok) => { if (!ok) toast('music blocked by the browser: tap ♪ up top to try again'); });
    behind.forEach((el) => { el.inert = false; });
    const r = sunHost.getBoundingClientRect();
    intro.style.clipPath = `circle(150% at ${r.left + r.width / 2}px ${r.top + r.height / 2}px)`;
    gsap.to(sunHost, { scale: 1.25, duration: 0.6, ease: 'power2.out' });
    requestAnimationFrame(() => {
      intro.style.clipPath = `circle(0% at ${r.left + r.width / 2}px ${r.top + r.height / 2}px)`;
      intro.classList.add('is-gone');
    });
    setTimeout(onStart, 350);
    // once the curtain is gone, stop everything that was animating behind it
    setTimeout(() => { tl.kill(); breathe?.kill(); intro.hidden = true; }, 1700);
  };
  intro.querySelectorAll('[data-start]').forEach((b) => b.addEventListener('click', () => start(b.dataset.start === 'sound')));
  intro.querySelector('[data-start="sound"]').focus({ preventScroll: true });
  if (import.meta.env.DEV && location.search.includes('skip')) start(false);
}
