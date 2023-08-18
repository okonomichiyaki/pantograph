describe('Metered API events', () => {
    beforeEach(function () {
      cy.createAndJoin('loup', 'runner');
    });

    it('handle call termination', () => {
        cy.mediaDevices([
            {label: 'webcam', deviceId: '1234'},
            {label: 'virtual', deviceId: '5678'},
        ]);
        cy.contains('share this link with your opponent').should('be.visible');
        cy.get('dialog#share-link-modal button.confirm-modal').click();
        cy.meteredEvent('stateChanged', ['terminated']);
        cy.contains('call ended').should('be.visible');
    });
});
