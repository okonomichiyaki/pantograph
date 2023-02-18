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
