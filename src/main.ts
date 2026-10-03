import '@fontsource-variable/fraunces';
import '@fontsource-variable/manrope';
import './styles/index.css';
import rawContent from './data/landing.json';
import type { LandingContent } from './core/types';
import { renderLanding } from './landing/render';
import { mountInteractions } from './landing/interactions';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('No se encontró el contenedor principal de Dermalysse.');
}

const content = rawContent as LandingContent;
app.innerHTML = renderLanding(content);
mountInteractions(content);
