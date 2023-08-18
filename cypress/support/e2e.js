import './commands';

beforeEach(() => {
  cy.intercept({ hostname: 'cdn.metered.ca' }, { statusCode: 503 });
  cy.viewport(1920, 1080);
});
