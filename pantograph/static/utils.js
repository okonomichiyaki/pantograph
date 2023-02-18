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

export function getQueryParams(key) {
    let params = new URLSearchParams(window.location.search);
    params = Object.fromEntries(params.entries());
    if (key) {
        return params[key];
    } else {
        return params;
    }
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

export function getVideoDims(video) {
    let vw = 0, vh = 0;
    if (video.nodeName === "VIDEO") {
        vw = video.videoWidth;
        vh = video.videoHeight;
    }
    return {vw, vh};
}

export function cropFromVideo(video, x, y, w, h) {
    const {vw, vh} = getVideoDims(video);
    if (vw === 0 || vh === 0) {
        return null;
    }
    const canvas = new OffscreenCanvas(vw, vh);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, vw, vh);
    return ctx.getImageData(x, y, w, h);
}

export function swapElements(a, b) {
    const parentA = a.parentElement;
    const parentB = b.parentElement;
    parentA.removeChild(a);
    parentB.removeChild(b);
    parentA.appendChild(b);
    parentB.appendChild(a);
}
