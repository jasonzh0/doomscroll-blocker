/**
 * The full-screen "you've doomscrolled" intervention, styled as a sci-fi
 * heads-up display: a red threshold alert that resolves into a calm cyan system
 * directive to go touch grass.
 *
 * The overlay is injected into arbitrary host pages, so it depends only on inline
 * styles + an injected keyframes block (no web fonts, no external resources). It
 * falls back to a technical system font stack when Orbitron/Rajdhani aren't
 * present on the host page.
 */
import { DEFAULT_WARNING_MESSAGE } from './constants';
import type { AlertSound, WarningConfig } from './types';

const OVERLAY_ID = 'doomscroll';
const STYLE_ID = 'doomscroll-style';
const TECH_FONT =
  "'Orbitron', 'Rajdhani', 'Eurostile', 'Bank Gothic', 'Arial Narrow', system-ui, sans-serif";

const prefersReducedMotion = (): boolean =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Play a brief generated cue without loading media or requesting permission. */
function playAlertSound(sound: AlertSound): void {
  if (sound === 'none') return;

  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + 0.02;

    oscillator.connect(gain);
    gain.connect(context.destination);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.16, start + 0.025);

    if (sound === 'chime') {
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(523.25, start);
      oscillator.frequency.setValueAtTime(783.99, start + 0.13);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.42);
      oscillator.stop(start + 0.43);
    } else {
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(196, start);
      oscillator.frequency.exponentialRampToValueAtTime(130.81, start + 0.2);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.24);
      oscillator.stop(start + 0.25);
    }

    oscillator.addEventListener('ended', () => void context.close());
    oscillator.start(start);
    void context.resume().catch(() => context.close());
  } catch {
    // Some browser/page policies can deny audio; the visual warning still runs.
  }
}

/** Inject keyframes once; `ds-` prefixed to avoid host-page collisions. */
function ensureKeyframes(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes ds-rise { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes ds-spin { to { transform: rotate(360deg); } }
    @keyframes ds-scan { 0% { transform: translateY(-10vh); } 100% { transform: translateY(110vh); } }
    @keyframes ds-flicker { 0%, 100% { opacity: 1; } 50% { opacity: 0.72; } }
  `;
  document.head.appendChild(style);
}

const div = (cssText: string): HTMLDivElement => {
  const el = document.createElement('div');
  el.style.cssText = cssText;
  return el;
};

interface Overlay {
  root: HTMLDivElement;
  grid: HTMLDivElement;
  scan: HTMLDivElement;
  ring: HTMLDivElement;
  eyebrow: HTMLDivElement;
  headline: HTMLDivElement;
  sub: HTMLDivElement;
  corners: HTMLDivElement[];
}

function cornerStyle(pos: string, color: string): string {
  const base =
    'position:absolute;width:26px;height:26px;pointer-events:none;filter:drop-shadow(0 0 6px ' +
    color +
    ');';
  const map: Record<string, string> = {
    tl: `top:18px;left:18px;border-top:2px solid ${color};border-left:2px solid ${color};`,
    tr: `top:18px;right:18px;border-top:2px solid ${color};border-right:2px solid ${color};`,
    bl: `bottom:18px;left:18px;border-bottom:2px solid ${color};border-left:2px solid ${color};`,
    br: `bottom:18px;right:18px;border-bottom:2px solid ${color};border-right:2px solid ${color};`,
  };
  return base + map[pos];
}

function buildOverlay(): Overlay {
  const reduced = prefersReducedMotion();

  const root = div(`
    position: fixed; inset: 0; z-index: 2147483600;
    display: flex; align-items: center; justify-content: center; flex-direction: column;
    text-align: center; padding: 8vw 6vw;
    background: radial-gradient(120% 95% at 50% 0%, #1a0b0c 0%, #0a0608 55%, #050406 100%);
    color: #ffe9e7; font-family: ${TECH_FONT};
    word-break: normal; overflow-wrap: normal; white-space: normal;
    transition: opacity 0.3s ease, background 0.6s ease;
    overflow: hidden;
  `);

  // Technical grid backdrop (tinted red for the alert).
  const grid = div(`
    position: absolute; inset: 0; pointer-events: none; opacity: 0.5;
    background-image:
      linear-gradient(rgba(255,68,56,0.10) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,68,56,0.10) 1px, transparent 1px);
    background-size: 34px 34px;
    -webkit-mask-image: radial-gradient(110% 90% at 50% 40%, #000 30%, transparent 80%);
    mask-image: radial-gradient(110% 90% at 50% 40%, #000 30%, transparent 80%);
  `);
  root.appendChild(grid);

  // Scan sweep.
  const scan = div(`
    position: absolute; left: 0; right: 0; top: 0; height: 26vh; pointer-events: none;
    background: linear-gradient(180deg, transparent, rgba(255,68,56,0.10));
  `);
  if (!reduced) scan.style.animation = 'ds-scan 4.5s linear infinite';
  root.appendChild(scan);

  // HUD corner brackets.
  const corners = (['tl', 'tr', 'bl', 'br'] as const).map((p) =>
    div(cornerStyle(p, 'rgba(255,68,56,0.7)'))
  );
  corners.forEach((c) => root.appendChild(c));

  // Wide content box; text-wrapping is reset with !important so a host page's
  // global word-break/overflow-wrap rules can't squish the headline.
  const content = div(
    'position: relative; width: 100%; max-width: 880px; display: flex; flex-direction: column; align-items: center; word-break: normal; overflow-wrap: normal;'
  );

  // Rotating targeting ring above the eyebrow.
  const ring = div(`
    width: 46px; height: 46px; border-radius: 50%; margin-bottom: 20px; flex-shrink: 0;
    border: 2px solid transparent; border-top-color: #ff4438; border-right-color: #ff4438;
    filter: drop-shadow(0 0 6px rgba(255,68,56,0.9));
  `);
  if (!reduced) ring.style.animation = 'ds-spin 2.6s linear infinite';

  const eyebrow = div(`
    text-transform: uppercase; letter-spacing: 0.4em; font-weight: 700; white-space: nowrap;
    font-size: clamp(0.72rem, 1.7vw, 0.95rem); color: #ff6a5e; margin-bottom: 1em; padding-left: 0.4em;
  `);
  eyebrow.textContent = '⚠ Threshold Exceeded';

  const headline = div(`
    text-transform: uppercase; font-weight: 800; max-width: 100%;
    font-size: clamp(2.6rem, 11vw, 7rem); line-height: 0.96; letter-spacing: 0.04em;
    word-break: keep-all !important; overflow-wrap: normal !important; white-space: normal !important; hyphens: none !important;
    color: #ff4438; text-shadow: 0 0 32px rgba(255,68,56,0.65), 0 0 6px rgba(255,68,56,0.9);
  `);
  headline.textContent = 'Doomscroll';
  if (!reduced)
    headline.style.animation = 'ds-flicker 2.4s ease-in-out infinite';

  const sub = div(`
    margin-top: 1.4em; max-width: 34ch; font-size: clamp(0.95rem, 2.4vw, 1.4rem); font-weight: 500;
    letter-spacing: 0.16em; text-transform: uppercase; line-height: 1.5;
    word-break: normal !important; overflow-wrap: normal !important; color: rgba(255,233,231,0.66);
  `);
  sub.textContent = 'Attention budget depleted // disengage';

  content.append(ring, eyebrow, headline, sub);
  root.appendChild(content);

  if (!reduced)
    content.style.animation = 'ds-rise 0.55s cubic-bezier(0.22,1,0.36,1) both';

  return { root, grid, scan, ring, eyebrow, headline, sub, corners };
}

/** Swap the alert into its calm cyan "directive: touch grass" resolution. */
function resolveToDirective(o: Overlay, message: string): void {
  o.root.style.background =
    'radial-gradient(120% 95% at 50% 0%, #07212b 0%, #061018 55%, #04080d 100%)';
  o.root.style.color = '#dff6fd';

  o.grid.style.backgroundImage =
    'linear-gradient(rgba(67,212,245,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(67,212,245,0.12) 1px, transparent 1px)';

  o.scan.style.background =
    'linear-gradient(180deg, transparent, rgba(67,212,245,0.10))';

  o.ring.style.borderTopColor = '#43d4f5';
  o.ring.style.borderRightColor = '#43d4f5';
  o.ring.style.filter = 'drop-shadow(0 0 6px rgba(67,212,245,0.9))';

  o.eyebrow.style.color = '#5fe3ff';
  o.eyebrow.textContent = '✓ System Directive';

  o.headline.style.color = '#aef2ff';
  o.headline.style.textShadow =
    '0 0 34px rgba(67,212,245,0.6), 0 0 6px rgba(67,212,245,0.85)';
  o.headline.style.animation = '';
  o.headline.textContent = message;

  o.sub.style.color = 'rgba(223,246,253,0.7)';
  o.sub.textContent = 'Disconnect // real light awaits';

  o.corners.forEach((c, i) => {
    const pos = (['tl', 'tr', 'bl', 'br'] as const)[i];
    c.style.cssText = cornerStyle(pos, 'rgba(67,212,245,0.7)');
  });
}

/**
 * Run the warning sequence: fade the page out behind a flashing red alert, then
 * replace the page with the calm cyan "touch grass" directive.
 */
export function runDoomscrollWarning(
  timing: WarningConfig,
  message: string = DEFAULT_WARNING_MESSAGE,
  sound: AlertSound = 'none'
): void {
  playAlertSound(sound);
  ensureKeyframes();
  const overlay = buildOverlay();
  const { root } = overlay;

  document.body.insertAdjacentElement('afterbegin', root);

  // Fade every existing page element out over the decay window.
  const pageChildren = Array.from(document.body.children).filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement && child.id !== OVERLAY_ID
  );
  for (const child of pageChildren) {
    child.style.transitionProperty = 'opacity';
    child.style.transitionDuration = `${timing.screenDecayTime}s`;
    void child.offsetHeight; // force reflow so the transition runs
    child.style.opacity = '0';
  }

  // Pulse the alert while the page decays (skipped under reduced motion).
  let flashId = 0;
  if (!prefersReducedMotion()) {
    let visible = true;
    flashId = window.setInterval(() => {
      visible = !visible;
      root.style.opacity = visible ? '1' : '0';
    }, timing.flashInterval);
  }

  window.setTimeout(() => {
    if (flashId) window.clearInterval(flashId);
    document.body.innerHTML = '';
    document.body.appendChild(root);
    root.style.opacity = '1';
    resolveToDirective(overlay, message);
  }, timing.screenDecayTime * 1000);
}
