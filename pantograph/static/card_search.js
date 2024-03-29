import {getComputedDims, cropFromVideo, getVideoDims} from './utils.js';
import {StatusEvent} from './events.js';

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

export async function cardSearch(event, pantograph) {
  const e = event.target;
  if (e.parentElement.id === 'secondary-container') {
    return;
  }
  document.body.classList.add('loading');

  const calibration = pantograph.calibration;
  const format = pantograph.format;
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

  let scaledCalibration = scaleCalibration(calibration, vw, vh);

  const requestBody = {
    image: data,
    calibration: scaledCalibration,
    side: side,
    format: format,
  };
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  };
  const response = await fetch('/recognize/', options)
        .catch((err) => console.error('error fetching /recognize/', err));
  if (response && response.status === 200) {
    const json = await response.json();
    json.side = side; // TODO
    pantograph.updateSearchResults(json);
  } else {
    const status = response ? response.status : 'x';
    const error = response ? response.body : '?';
    pantograph.updateSearchResults({error, status});
    pantograph.logEvent(new StatusEvent('pantograph', 'error', 'error from server', '⚠️', true));
  }
  document.body.classList.remove('loading');
};
