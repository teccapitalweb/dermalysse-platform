import '@fontsource-variable/fraunces';
import '@fontsource-variable/manrope';
import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/club.css';
import rawContent from '../data/landing.json';
import type { LandingContent } from '../core/types';
import { renderClub } from './render';
import { mountClubInteractions } from './interactions';

const root = document.querySelector<HTMLDivElement>('#club-app');

if (!root) {
  throw new Error('No se encontró el contenedor del club Dermalysse.');
}

const content = rawContent as LandingContent;
root.innerHTML = renderClub(content);
mountClubInteractions(content);
