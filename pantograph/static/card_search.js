import { getComputedDims, cropFromVideo, getVideoDims } from './utils.js';

function scaleCalibration(calibration, vw, vh) {
    if (calibration) {
        let ratio = calibration.ratio;
        let w = vw * ratio.w;
        let h = vh * ratio.h;
        return {w, h};
    } else {
        return {w: 100, h: 200};
    }
}

function debugCalibration(calibration, canvas, ctx, vw, vh) {
    let {w, h} = scaleCalibration(calibration, vw, vh);
    let x = canvas.width / 2 - w / 2;
    let y = canvas.height / 2 - h / 2;
    ctx.strokeStyle = 'deeppink';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
}

function debugOutput(response) {
    const b64 = response.img;
    const dataUri = `data:image/jpeg;base64,${b64}`;
    let container = document.getElementById('debug-image-container');
    container.replaceChildren();
    var img = document.createElement('img');
    img.src = dataUri;
    container.appendChild(img);

    if (response.reasons && response.reasons.length > 0) {
        let logs = response.reasons.map(([t,r]) => t + ',' + r).join('\n');
        let display = document.getElementById('debug-search-logs');
        display.innerText = '';
        display.innerText = logs;
    }

    if (response.cards && response.cards.length > 1) {
        let cards = response.cards.slice(1);
        let titles = cards.map(card => card.title + ',' + card.dist).join('\n');
        let display = document.getElementById('debug-alternates');
        display.innerText = '';
        display.innerText = titles;
    }
}

export function cardSearch(event, calibration, format) {
    const e = event.target;
    if (e.parentElement.id === 'secondary-container') {
        return ;
    }
    const side = e.side;

    // crop a 300x300 square from the video feed around the mouse click:
    const x = event.offsetX;
    const y = event.offsetY;
    const w = 300;
    const h = 300;

    const target = event.target;
    const {w: targetw, h: targeth} = getComputedDims(target);
    const {vw, vh} = getVideoDims(target);


    // scale the x,y to match the element coords with video coords:
    const calcx = Math.round(x / targetw * vw);
    const calcy = Math.round(y / targeth * vh);
    const rx = calcx - w / 2;
    const ry = calcy - h / 2;

    console.log(`click: offset=${x},${y} calc=${calcx}x${calcy} rect: ${rx},${ry},${w},${h} target: (computed) ${targetw}x${targeth}, (video) ${vw}x${vh}`);

    const imageData = cropFromVideo(target, rx, ry, w, h);
    if (imageData === null) {
        console.error('got null from video crop, clicked on:', event.target);
        return;
    }
    const crop = document.getElementById('crop');
    const ctx = crop.getContext('2d');
    ctx.clearRect(0, 0, crop.width, crop.height);
    ctx.putImageData(imageData, 0, 0);

    // get data to POST to server:
    const data = crop.toDataURL();

    // then render calibration for debugging: (AFTER extracting data)
    debugCalibration(calibration, crop, ctx, vw, vh);

    const json = {
        image: data,
        calibration: scaleCalibration(calibration, vw, vh),
        side: side,
        format: format
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
            let cards = response.cards;
            let container = document.getElementById('card-container');
            container.replaceChildren();
            if (cards.length > 0) {
                console.log(response);
                for (const card of cards) {
                    console.log(`received card(s) from server: ${card.title}`);
                }
                let card = cards[0];
                var img = document.createElement('img');
                var size = 'large';
                img.src = 'https://static.nrdbassets.com/v1/' + size + '/' + card.code + '.jpg';
                img.alt = card.title;
                img.classList.add('card');
                container.appendChild(img);
                debugOutput(response);
            } else {
                const unknown = document.createElement('div');
                unknown.innerHTML = '❓';
                unknown.id = 'unknown-card';
                container.appendChild(unknown);
            }
        })
        .catch(err => console.error(err));
};
