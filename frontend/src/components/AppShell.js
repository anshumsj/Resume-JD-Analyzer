/**
 * AppShell — application layout with header, main content area, and footer.
 *
 * Usage:
 *   import { createAppShell } from './components/AppShell.js';
 *   const shell = createAppShell();
 *   document.getElementById('app').appendChild(shell.root);
 *   shell.main.appendChild(yourContent);
 */

/**
 * Creates the application shell layout.
 * @returns {{ root: HTMLElement, main: HTMLElement }}
 */
export function createAppShell() {
  const root = document.createElement('div');
  root.className = 'app-shell';

  // --- Header ---
  const header = document.createElement('header');
  header.className = 'app-header';
  header.setAttribute('role', 'banner');

  const brand = document.createElement('a');
  brand.className = 'app-header__brand';
  brand.href = '/';
  brand.setAttribute('aria-label', 'JobFit AI — Home');

  const brandMark = document.createElement('span');
  brandMark.className = 'app-header__brand-mark';
  brandMark.setAttribute('aria-hidden', 'true');

  const brandTitle = document.createElement('span');
  brandTitle.className = 'app-header__title';
  brandTitle.textContent = 'JobFit AI';

  const separator = document.createElement('span');
  separator.className = 'app-header__separator';
  separator.setAttribute('aria-hidden', 'true');
  separator.textContent = '/';

  const tagline = document.createElement('span');
  tagline.className = 'app-header__tagline';
  tagline.textContent = 'Resume intelligence';

  brand.appendChild(brandMark);
  brand.appendChild(brandTitle);
  brand.appendChild(separator);
  brand.appendChild(tagline);

  header.appendChild(brand);

  // --- Main ---
  const main = document.createElement('main');
  main.className = 'app-main';
  main.setAttribute('role', 'main');
  main.id = 'main-content';

  // --- Footer ---
  const footer = document.createElement('footer');
  footer.className = 'app-footer';
  footer.setAttribute('role', 'contentinfo');

  const footerText = document.createElement('span');
  footerText.className = 'app-footer__text';
  footerText.textContent = `JobFit AI — Resume-to-JD analysis`;

  footer.appendChild(footerText);

  // --- Assemble ---
  root.appendChild(header);
  root.appendChild(main);
  root.appendChild(footer);

  return { root, main, header, footer };
}
