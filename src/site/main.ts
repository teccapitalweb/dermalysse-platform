import { instalarBaseShim } from '../core/base-shim';
instalarBaseShim();
import '@fontsource-variable/fraunces';
import '@fontsource-variable/manrope';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/landing.css';
import './styles/responsive.css';
import './styles/assistant.css';
import rawContent from './landing.json';
import type { LandingContent } from './types';
import { renderLanding } from './render';
import { mountInteractions } from './interactions';
import { mountAssistant } from './assistant';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('No se encontró el contenedor principal de Dermalysse.');

const content = rawContent as LandingContent;
app.innerHTML = renderLanding(content);
mountInteractions(content);
mountAssistant(content);
