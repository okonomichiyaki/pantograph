describe('demo mode', () => {
  it('card search via click', () => {
    cy.visit('/app/demo/?runner=esa%CC%82&corp=thule&local=0');
    cy.get('#remote-video').should('have.prop', 'ended', true);
    cy.get('#local-video').should('have.prop', 'ended', true);
    cy.get('#remote-placeholder').should('not.be.visible');
    cy.get('#remote-video').clickByPercentage(915 / 1280, 615 / 720);
    cy.get('img[alt="Spin Doctor"]').should('be.visible');
    cy.contains('swap video').click();
    cy.get('#local-video').clickByPercentage(765 / 1280, 605 / 720);
    cy.get('img[alt="No Free Lunch"]').should('be.visible');
  });
});
