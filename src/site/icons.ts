export const icon = (name: 'arrow' | 'play' | 'menu' | 'close' | 'spark' | 'check' | 'drop'): string => {
  const paths = {
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    play: '<path d="m9 7 8 5-8 5V7Z"/>',
    menu: '<path d="M4 8h16M4 16h16"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    spark: '<path d="M12 2c.7 5.4 2.6 7.3 8 8-5.4.7-7.3 2.6-8 8-.7-5.4-2.6-7.3-8-8 5.4-.7 7.3-2.6 8-8Z"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    drop: '<path d="M12 2.8S5.4 10 5.4 15.1a6.6 6.6 0 0 0 13.2 0C18.6 10 12 2.8 12 2.8Z"/><path d="M8.2 15.6a4 4 0 0 0 4 3.7"/>',
  } as const;

  return `<svg class="icon icon--${name}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name]}</svg>`;
};
