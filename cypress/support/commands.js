function getComputedDims(e) {
    let style;
    try {
        style = window.getComputedStyle(e);
    } catch (ex) {
        return null;
    }
    const widthStr = style.width;
    const heightStr = style.height;
    if (widthStr.includes("px") && heightStr.includes("px")) {
        const w = parseFloat(widthStr.replace("px", ""));
        const h = parseFloat(heightStr.replace("px", ""));
        return {w : Math.round(w), h: Math.round(h)};
    }
    return [];
}

function clickByPercentage($el, xpct, ypct) {
    const dims = getComputedDims($el.get(0));
    const xpx = Math.round(dims.w * xpct);
    const ypx = Math.round(dims.h * ypct);
    cy.wrap($el).click(xpx, ypx);
}

Cypress.Commands.add('clickByPercentage', { prevSubject: true }, clickByPercentage);

// this is a bit of a hack. gets around difficulty stubbing Metered.meeting
const callbacks = {};
const devices = [];
let localVideoUrl = "https://pantograph.cbgpnck.net/video/padma-720p.mp4";

Cypress.on('window:before:load', (win) => {
  cy.stub(win.navigator.mediaDevices, 'getUserMedia', (constraints) => {
    return Promise.resolve({});
  });
  class Meeting {
    constructor() {}
    listVideoInputDevices() {
      return Promise.resolve(devices);
    }
    join(params) { return Promise.resolve({}); }
    on(evt, fn) {
      callbacks[evt] = fn;
    }
  };
  win.Metered = { Meeting: Meeting };
});

Cypress.Commands.add('mediaDevices', (newDevices) => {
  devices.length = 0;
  devices.push(...newDevices);
});

Cypress.Commands.add('meteredEvent', (evt, params) => {
  callbacks[evt].apply(null, params);
});

Cypress.Commands.add('localVideo', (url) => {
  localVideoUrl = url;
});
