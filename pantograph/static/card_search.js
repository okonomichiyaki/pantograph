import {getComputedDims, cropFromVideo, getVideoDims} from './utils.js';

function scaleCalibration(calibration, vw, vh) {
  if (calibration) {
    const ratio = calibration.ratio;
    const w = vw * ratio.w;
    const h = vh * ratio.h;
    return {w, h};
  } else {
    return {w: 145, h: 200};
  }
}

function debugCalibration(calibration, canvas, ctx, vw, vh) {
  const {w, h} = scaleCalibration(calibration, vw, vh);
  const x = canvas.width / 2 - w / 2;
  const y = canvas.height / 2 - h / 2;
  ctx.strokeStyle = 'deeppink';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
}

function getShift(max) {
  return max - Math.round(Math.random() * max * 2);
}

function getRandomClicks(count, max, x, y) {
  const clicks = [{x: x, y: y}];
  for (let i = 0; i < count; i++) {
    // TODO limit these by total w/h
    clicks.push({x: x + getShift(max), y: y + getShift(max)});
  }
  return clicks;
}

function getCrop(target, x, y, w, h, targetw, targeth, vw, vh) {
  // scale the x,y to match the element coords with video coords:
  const calcx = Math.round(x / targetw * vw);
  const calcy = Math.round(y / targeth * vh);
  const rx = calcx - w / 2;
  const ry = calcy - h / 2;

  console.log(`click: offset=${x},${y} calc=${calcx}x${calcy} rect: ${rx},${ry},${w},${h} target: (computed) ${targetw}x${targeth}, (video) ${vw}x${vh}`);

  const imageData = cropFromVideo(target, rx, ry, w, h);
  if (imageData === null) {
    console.error('got null from video crop, clicked on:', target);
    return null;
  }
  const crop = document.getElementById('crop');
  const ctx = crop.getContext('2d');
  ctx.clearRect(0, 0, crop.width, crop.height);
  ctx.putImageData(imageData, 0, 0);

  // get data to POST to server:
  return crop.toDataURL();
}

export function cardSearch(event, pantograph) {
  const e = event.target;
  if (e.parentElement.id === 'secondary-container') {
    return;
  }

  const calibration = pantograph.calibration;
  const format = pantograph.format;
  const side = e.side;
  const w = 300;
  const h = 300;

  const target = event.target;
  const {w: targetw, h: targeth} = getComputedDims(target);
  const {vw, vh} = getVideoDims(target);
  let scaledCalibration = scaleCalibration(calibration, vw, vh);

  // crop a 300x300 square from the video feed around the mouse click:
  const ox = event.offsetX;
  const oy = event.offsetY;

  const clicks = getRandomClicks(0, 5, ox, oy);
  const images = [];
  for (let click of clicks) {
    const {x, y} = click;
    const data = getCrop(target, x, y, w, h, targetw, targeth, vw, vh);
    images.push(data);
  }

  // then render calibration for debugging: (AFTER extracting data)
  //debugCalibration(calibration, crop, ctx, vw, vh);

  const json = {
    images: images,
    calibration: scaledCalibration,
    side: side,
    format: format,
  };
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(json),
  };
  fetch('/recognize/', options)
      .then((response) => response.json())
      .then((response) => {
        const result = {};
        result.side = side; // TODO
        result.cards = response.flatMap(r => r.cards);
        pantograph.updateSearchResults(result);
      })
      .catch((err) => console.error(err));
};
