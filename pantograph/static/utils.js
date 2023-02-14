export function getCookies() {
    const cookies = document.cookie.split('; ');
    const results = {};
    for (let i = 0; i < cookies.length; i++) {
        let cookie = cookies[i];
        let pair = cookie.split('=');
        results[pair[0]] = pair[1];
    }
    return results;
}

export function getQueryParams() {
    const params = new URLSearchParams(window.location.search);
    return Object.fromEntries(params.entries());
}

export function getComputedDims(e) {
    let style;
    try {
        style = window.getComputedStyle(e);
    } catch (e) {
        return null;
    }
    const widthStr = style.width;
    const heightStr = style.height;
    if (widthStr.includes("px") && heightStr.includes("px")) {
        const w = parseFloat(widthStr.replace("px", ""));
        const h = parseFloat(heightStr.replace("px", ""));
        return {w : Math.round(w), h: Math.round(h)};
    }
    return null;
}

export function cropFromVideo(video, x, y, w, h) {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (vw === 0 || vh === 0) {
        return null;
    }
    const canvas = new OffscreenCanvas(vw, vh);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, vw, vh);
    return ctx.getImageData(x, y, w, h);
}
