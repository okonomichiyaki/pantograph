
describe('getUserMedia and Metered APIs', () => {
    // this is a bit of a hack. gets around difficulty stubbing Meetered.meeting
    const callbacks = {};

    Cypress.on('window:before:load', (win) => {
        // const mediaDevices = cy.stub().as('mediaDevices');
        // Object.defineProperty(win.navigator, 'mediaDevices', {
        //     value: mediaDevices
        // });

        cy.stub(win.navigator.mediaDevices, 'getUserMedia', (constraints) => {
            return Promise.resolve({});
        });

        class Meeting {
            constructor() {}
            listVideoInputDevices() {
                return Promise.resolve([
                    {label: 'webcam', deviceId: '1234'},
                    {label: 'virtual', deviceId: '5678'},
                ]);
            }
            join(params) { return Promise.resolve({}); }
            on(evt, fn) {
                callbacks[evt] = fn;
            }
        };
        win.Metered = { Meeting: Meeting };
        //cy.stub().as('Metered');
    });

    Cypress.Commands.add('meteredEvent', (evt, params) => {
        console.log(callbacks);
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
        // after loading /app/<room id> will be presented with the modal:
        cy.contains('share this link with your opponent').should('be.visible');
        cy.get('dialog#share-link-modal button.confirm-modal').click();
    });

    it('lists video devices', () => {
        cy.get('#video-device option').should('have.length', 2);
    });

    it('handle call termination', () => {
        cy.meteredEvent('stateChanged', ['terminated']);
        cy.contains('call terminated for length').should('be.visible');
    });
});
