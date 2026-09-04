/**
 * Main entry point — JobFit AI frontend.
 * Mounts the application shell and initializes the analysis input experience.
 */

import './styles/global.css';

import { createAppShell } from './components/AppShell.js';
import { createAnalyzePage } from './pages/AnalyzePage.js';

// Mount application shell
const app = document.getElementById('app');
const shell = createAppShell();
app.appendChild(shell.root);

// Mount main analysis page
const analyzePage = createAnalyzePage();
shell.main.appendChild(analyzePage.element);
