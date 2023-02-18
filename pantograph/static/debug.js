import { getQueryParams } from './utils.js';

export function setModes() {
    const params = getQueryParams();
    window.modes = {};
    for (const [k ,v] of Object.entries(params)) {
        if (k.includes('mode') && v === 'true') {
            const clss = k.replace('-mode', '');
            document.body.classList.add(clss);
            window.modes[clss] = true;
        }
    }
}

export function getModes() {
    const modes = [];
    for (const [k ,v] of Object.entries(window.modes)) {
        if (v) {
            modes.push(k);
        }
    }
    return modes;
}

export function debugOff() {
    const modes = getModes();
    return modes.length === 0;
}

export function isModeOn(mode) {
    return window.modes[mode] === true;
}
