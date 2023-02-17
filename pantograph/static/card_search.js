import { getComputedDims, cropFromVideo, getVideoDims } from "./utils.js";

function getFormat() {
    if (window.format) {
        return window.format;
    }
    return null;
}

function getSide() {
    if (window.side === 'corp') {
        return 'runner';
    }
    if (window.side === 'runner') {
        return 'corp';
    }
    return null;
}

function getCalibration(vw, vh) {
    if (window.calibration) {
        let calibration = window.calibration.ratio;
        let w = vw * calibration.w;
        let h = vh * calibration.h;
        return {w, h};
    } else {
        return {w: 100, h: 200};
    }
}

function debugCalibration(canvas, ctx, vw, vh) {
    let {w, h} = getCalibration(vw, vh);
    let x = canvas.width / 2 - w / 2;
    let y = canvas.height / 2 - h / 2;
    ctx.strokeStyle = "deeppink";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
}

export function handleClick(event) {
    // crop a 300x300 square from the video feed around the mouse click:

    const x = event.offsetX;
    const y = event.offsetY;
    const w = 300;
    const h = 300;

    const target = event.target;
    const {w: targetw, h: targeth} = getComputedDims(target);
    const {vw, vh} = getVideoDims(target);

    console.log(`click: ${event.target} ${x},${y}`);
    console.log(`target: (computed) ${targetw}x${targeth}, (video) ${vw}x${vh}`);

    // scale the x,y to match the element coords with video coords:
    const calcx = (x / targetw) * vw;
    const calcy = (y / targeth) * vh;
    const rx = calcx - w / 2;
    const ry = calcy - h / 2;

    console.log(`rect: ${rx},${ry},${w},${h}`);

    const imageData = cropFromVideo(target, rx, ry, w, h);
    if (imageData === null) {
        console.log("got null from video crop, clicked on:", event.target);
        return;
    }
    const crop = document.getElementById('crop');
    const ctx = crop.getContext("2d");
    ctx.clearRect(0, 0, crop.width, crop.height);
    ctx.putImageData(imageData, 0, 0);
    debugCalibration(crop, ctx, vw, vh);

    // POST to server:
    const data = crop.toDataURL();
    const json = {
        image: data,
        calibration: getCalibration(vw, vh),
        side: getSide(),
        format: getFormat()
    };
    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(json)
    };
    fetch('/recognize', options)
        .then(response => response.json())
        .then(response => {
            let container = document.getElementById('card-container');
            container.replaceChildren();
            if (response.length > 0) {
                for (const card of response) {
                    console.log(`received card(s) from server: ${card.title}`);
                }
                let card = response[0];
                var img = document.createElement('img');
                var size = "large";
                img.src = "https://static.nrdbassets.com/v1/" + size + "/" + card.code + ".jpg";
                container.appendChild(img);
            } else {
                const unknown = document.createElement('div');
                unknown.innerHTML = "❓";
                unknown.id = "unknown-card";
                container.appendChild(unknown);
            }
        })
        .catch(err => console.error(err));
};
