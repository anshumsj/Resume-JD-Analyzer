/**
 * Main entry point — JobFit AI frontend.
 * Mounts the application shell and verifies the design system renders correctly.
 */

import './styles/global.css';

import { createAppShell } from './components/AppShell.js';
import { checkHealth } from './utils/api.js';

// Mount application shell
const app = document.getElementById('app');
const shell = createAppShell();
app.appendChild(shell.root);

// Placeholder content for M13-A — confirms the shell renders
const welcomeSection = document.createElement('div');
welcomeSection.style.display = 'flex';
welcomeSection.style.flexDirection = 'column';
welcomeSection.style.gap = 'var(--space-4)';

const title = document.createElement('h1');
title.className = 'text-page-title';
title.textContent = 'Analyze Job Fit';

const description = document.createElement('p');
description.className = 'text-secondary';
description.textContent = 'Upload a resume and paste a job description to evaluate candidate-to-role alignment.';

welcomeSection.appendChild(title);
welcomeSection.appendChild(description);
shell.main.appendChild(welcomeSection);

// Health check — verify API connectivity
const statusEl = document.getElementById('health-status');
async function checkApiHealth() {
  try {
    const health = await checkHealth();
    if (health.status === 'ok') {
      statusEl.textContent = 'API Connected';
      statusEl.style.color = 'var(--color-success)';
    }
  } catch {
    statusEl.textContent = 'API Offline';
    statusEl.style.color = 'var(--color-text-muted)';
  }
}
checkApiHealth();
