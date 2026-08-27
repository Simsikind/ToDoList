// Palette + light/dark mode switching. Selection persists in localStorage;
// the actual attributes are set for the first time by the inline script in
// index.html <head> (before this module loads) to avoid a flash of the
// wrong theme.

export const PALETTES = [
    { id: 'a', swatch: '#4338CA' },
    { id: 'b', swatch: '#4F6B4C' },
    { id: 'c', swatch: '#A9611E' },
    { id: 'd', swatch: '#7A2E62' },
];

const PALETTE_KEY = 'theme_palette';
const MODE_KEY = 'theme_mode'; // 'light' | 'dark' | 'system'

function resolveMode(mode) {
    if (mode === 'system') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return mode;
}

export function getPalette() {
    return localStorage.getItem(PALETTE_KEY) || 'a';
}

export function getMode() {
    return localStorage.getItem(MODE_KEY) || 'system';
}

export function setPalette(id) {
    localStorage.setItem(PALETTE_KEY, id);
    document.documentElement.setAttribute('data-palette', id);
}

export function setMode(mode) {
    localStorage.setItem(MODE_KEY, mode);
    document.documentElement.setAttribute('data-mode', resolveMode(mode));
}

export function initTheme() {
    // Attributes are already set by the inline head script; just keep them
    // in sync if the OS theme changes while "system" is selected.
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (getMode() === 'system') {
            document.documentElement.setAttribute('data-mode', resolveMode('system'));
        }
    });
}
