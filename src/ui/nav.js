import { ScrollTrigger } from 'gsap/ScrollTrigger';

export function initNav({ lenis, audio }) {
  const nav = document.querySelector('[data-nav]');
  const menu = document.querySelector('[data-menu]');
  const burger = document.querySelector('[data-burger]');

  const go = (hash) => {
    const el = document.querySelector(hash);
    if (!el) return;
    // the pass is the end of the journey: land on it, not on the section title
    const target = hash === '#contact' ? document.querySelector('[data-pass]') : el;
    const offset = hash === '#contact' ? -innerHeight * 0.18 : hash === '#pico' ? innerHeight * 1.2 : 0;
    lenis.scrollTo(target, { offset, duration: 2.2 });
  };
  document.querySelectorAll('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const hash = a.getAttribute('href');
    if (hash.length < 2) return;
    e.preventDefault();
    closeMenu();
    if (hash === '#top') lenis.scrollTo(0, { duration: 2 }); else go(hash);
  }));

  const closeMenu = () => { menu.hidden = true; burger.setAttribute('aria-expanded', 'false'); };
  burger.addEventListener('click', () => {
    const open = menu.hidden;
    menu.hidden = !open;
    burger.setAttribute('aria-expanded', String(open));
  });

  lenis.on('scroll', ({ scroll }) => nav.classList.toggle('is-solid', scroll > innerHeight * 3.2));

  const links = [...document.querySelectorAll('.nav__links a')];
  links.forEach((a) => {
    const section = document.querySelector(a.getAttribute('href'));
    ScrollTrigger.create({
      trigger: section, start: 'top 50%', end: 'bottom 50%', refreshPriority: -1,
      onToggle: (st) => a.classList.toggle('is-active', st.isActive),
    });
  });

  // the music toggle mirrors whatever the player is doing
  const sound = document.querySelector('[data-sound]');
  sound.addEventListener('click', () => audio.toggle());
  audio.onChange((on) => sound.setAttribute('aria-pressed', String(on)));
}
