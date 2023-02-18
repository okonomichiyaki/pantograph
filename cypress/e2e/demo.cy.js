describe('card search via click in demo mode', () => {
    it('passes', () => {
        cy.viewport(1920, 1080);
        cy.visit('http://localhost:8000/?demo-mode=true');
        cy.get('button#new-room-button').click();
        cy.contains('choose a nickname for yourself').should('be.visible');
        cy.get('input#nickname').type('loup');
        cy.get('input#startup').click();
        cy.get('input#runner').click();
        cy.get('button.confirm-modal').click();
        cy.contains('share this link with your opponent').should('be.visible');
        cy.get('dialog#share-link-modal button.confirm-modal').click();
        cy.get('#remote-video').should('have.prop', 'paused', false);
        cy.get('#remote-placeholder').should('not.be.visible');
        cy.get('#remote-video').clickByPercentage(950 / 1280, 600 / 720);
        cy.get('img[alt="Spin Doctor"]').should('be.visible');
        cy.contains('swap video').click();
        cy.get('#local-video').clickByPercentage(785 / 1280, 600 / 720);
        cy.get('img[alt="No Free Lunch"]').should('be.visible');
    });
});
