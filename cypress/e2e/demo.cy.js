describe('card search via click in demo mode', () => {
  it('passes', () => {
    cy.viewport(1920, 1080);
    cy.visit('http://localhost:8000/app/demo?runner=esâ&corp=thule&local=0');
    cy.get('#remote-video').should('have.prop', 'paused', false);
    cy.get('#remote-video').should('have.css', 'width', '1280px');
    cy.get('#remote-placeholder').should('not.be.visible');
    cy.get('#remote-video').clickByPercentage(915 / 1280, 615 / 720);
    cy.get('img[alt="Spin Doctor"]').should('be.visible');
    cy.contains('swap video').click();
    cy.get('#local-video').clickByPercentage(765 / 1280, 605 / 720);
    cy.get('img[alt="No Free Lunch"]').should('be.visible');
  });
});
