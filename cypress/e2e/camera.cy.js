
describe('getUserMedia and Metered APIs', () => {
    // this is a bit of a hack. gets around difficulty stubbing Meetered.meeting
    const callbacks = {};
    const devices = [];

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

    beforeEach(function () {
        cy.intercept({ hostname: 'cdn.metered.ca' }, { statusCode: 503 });
        cy.viewport(1920, 1080);
        cy.visit('http://localhost:8000/');

        // should be able to stub room API to avoid repeating this:
        cy.get('button#new-room-button').click();
        cy.contains('choose a nickname for yourself').should('be.visible');
        cy.get('input#nickname').type('loup');
        cy.get('input#startup').click();
        cy.get('input#runner').click();
        cy.get('button.confirm-modal').click();
        // after loading /app/<room id> will be presented with the modal
        // tests below click through this to allow preparing devices stub
    });

    it('lists video devices', () => {
        cy.mediaDevices([
            {label: 'webcam', deviceId: '1234'},
            {label: 'virtual', deviceId: '5678'},
        ]);
        cy.contains('share this link with your opponent').should('be.visible');
        cy.get('dialog#share-link-modal button.confirm-modal').click();
        cy.get('#video-device option').should('have.length', 2);
    });

    it.only('shows an error if no devices', () => {
        cy.mediaDevices([]);
        cy.contains('share this link with your opponent').should('be.visible');
        cy.get('dialog#share-link-modal button.confirm-modal').click();
        cy.get('#video-device option').should('have.length', 1);
        cy.contains('unable to find camera').should('be.visible');
    });


    it('handle call termination', () => {
        // after loading /app/<room id> will be presented with the modal:
        cy.contains('share this link with your opponent').should('be.visible');
        cy.get('dialog#share-link-modal button.confirm-modal').click();
        cy.meteredEvent('stateChanged', ['terminated']);
        cy.contains('call terminated for length').should('be.visible');
    });
});
