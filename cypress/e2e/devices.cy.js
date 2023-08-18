describe('device menu', () => {
    beforeEach(function () {
      cy.createAndJoin('loup', 'runner');
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

    it('shows an error if no devices', () => {
        cy.mediaDevices([]);
        cy.contains('share this link with your opponent').should('be.visible');
        cy.get('dialog#share-link-modal button.confirm-modal').click();
        cy.get('#video-device option').should('have.length', 1);
        cy.contains('unable to find camera').should('be.visible');
    });

});
