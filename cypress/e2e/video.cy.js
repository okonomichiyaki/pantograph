describe('video call', () => {
  beforeEach(function () {
    cy.createAndJoin('loup', 'runner');
  });

  it('click local video', () => {
    cy.mediaDevices([
      {label: 'webcam', deviceId: '1234'},
    ]);
    cy.contains('share this link with your opponent').should('be.visible');
    cy.get('dialog#share-link-modal button.confirm-modal').click();

    cy.localVideo("/video/padma-720p.mp4");
    cy.contains('start camera').click();
    cy.contains('swap video').click();
    cy.get('#local-video').clickByPercentage(540 / 1280, 365 / 720);
    cy.get('img[alt="Endurance"]').should('be.visible');
  });
});
