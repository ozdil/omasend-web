export type Child = Node | string | null | undefined | false;

/**
 * Minimal DOM builder. Text children are always inserted as text nodes, so values coming from
 * the engine, a pairing link or a file name can never become markup.
 */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | boolean> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === false) continue;
    if (key === 'class') node.className = String(value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child);
  }
  return node;
}

/**
 * Keyboard behaviour for a modal already placed in the page: focus moves into it, Tab stays
 * inside it, Escape closes it, and focus goes back to where it was when it closes.
 * Returns a function that undoes the listeners and restores focus.
 */
export function trapModal(card: HTMLElement, onEscape: () => void, initial?: HTMLElement): () => void {
  const opener = document.activeElement as HTMLElement | null;
  const focusable = () =>
    Array.from(card.querySelectorAll<HTMLElement>('button, input, textarea, select, a[href], [tabindex]:not([tabindex="-1"])')).filter(
      (n) => !n.hasAttribute('disabled'),
    );
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onEscape();
    } else if (e.key === 'Tab') {
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };
  document.addEventListener('keydown', onKey);
  (initial ?? focusable()[0])?.focus();
  return () => {
    document.removeEventListener('keydown', onKey);
    opener?.focus();
  };
}

/** Static, constant SVG markup only — never pass dynamic values here. */
export function staticSvg(markup: string): Element {
  const tpl = document.createElement('template');
  tpl.innerHTML = markup.trim();
  return tpl.content.firstElementChild as Element;
}

export const LOGO_SVG = `
  <svg class="header-logo" viewBox="0 0 300 300" aria-hidden="true">
    <path fill="currentColor" d="M0 0h180v20h-180zM200 0h100v20h-100zM0 20h20v20h-20zM140 20h20v20h-20zM240 20h60v20h-60zM0 40h20v20h-20zM40 40h120v20h-120zM220 40h40v20h-40zM280 40h20v20h-20zM0 60h20v20h-20zM40 60h20v20h-20zM200 60h40v20h-40zM280 60h20v20h-20zM0 80h20v20h-20zM40 80h20v20h-20zM180 80h40v20h-40zM0 100h20v20h-20zM40 100h20v20h-20zM160 100h40v20h-40zM240 100h20v20h-20zM280 100h20v20h-20zM0 120h20v20h-20zM40 120h20v20h-20zM160 120h20v20h-20zM240 120h20v20h-20zM280 120h20v20h-20zM0 140h60v20h-60zM240 140h20v20h-20zM280 140h20v20h-20zM0 160h20v20h-20zM40 160h20v20h-20zM240 160h20v20h-20zM280 160h20v20h-20zM0 180h20v20h-20zM40 180h20v20h-20zM240 180h20v20h-20zM280 180h20v20h-20zM0 200h20v20h-20zM40 200h20v20h-20zM240 200h20v20h-20zM280 200h20v20h-20zM0 220h20v20h-20zM40 220h20v20h-20zM240 220h20v20h-20zM280 220h20v20h-20zM0 240h20v20h-20zM40 240h220v20h-220zM280 240h20v20h-20zM0 260h20v20h-20zM140 260h20v20h-20zM280 260h20v20h-20zM0 280h160v20h-160zM180 280h120v20h-120z"/>
  </svg>`;

export const GEAR_SVG = `
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>`;
