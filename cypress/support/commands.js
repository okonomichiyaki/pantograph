// command for clicking an element by percentage of width&height:
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

// commands for stubbing Metered API: this is a bit of a hack. gets around difficulty stubbing Metered.meeting
const callbacks = {};
const devices = [];
let localVideoUrl = "";
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
    startVideo() {
      const video = document.createElement('video');
      video.src = localVideoUrl;
      video.loop = true;
      video.play().then(function() {
        let stream;
        if (video.captureStream) {
          stream = video.captureStream();
        }
        if (video.mozCaptureStream) {
          stream = video.mozCaptureStream();
        }
        if (stream && stream.getVideoTracks().length > 0) {
          const track = stream.getVideoTracks()[0];
          const item = {
            type: 'video',
            track: track,
          };
          const onLocalStarted = callbacks["localTrackStarted"];
          onLocalStarted(item);
        }
      });
    }
    chooseVideoInputDevice(deviceId) { return Promise.resolve({}); }
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

// command for creating and joining a room as a specific side:
Cypress.Commands.add('createAndJoin', (nick, side) => {
  cy.visit('http://localhost:8000/');
  // should be able to stub room API to avoid repeating this: (?)
  cy.get('button#new-room-button').click();
  cy.contains('choose a nickname for yourself').should('be.visible');
  cy.get('input#nickname').type(nick);
  cy.get('input#startup').click();
  cy.get('input#' + side).click();
  cy.get('button.confirm-modal').click();
  // after loading /app/<room id> will be presented with the modal
  // tests below click through this to allow preparing devices stub
});
