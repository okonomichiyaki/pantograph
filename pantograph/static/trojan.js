
function makeDraggable(card) {
  let startX = 0, startY = 0, clientX = 0, clientY = 0;
  card.onmousedown = dragMouseDown;
  function dragMouseDown(e) {
    e.preventDefault();
    clientX = e.clientX;
    clientY = e.clientY;
    document.onmouseup = onMouseUp;
    document.onmousemove = onMouseMove;
  }
  function onMouseMove(e) {
    e.preventDefault();
    startX = clientX - e.clientX;
    startY = clientY - e.clientY;
    clientX = e.clientX;
    clientY = e.clientY;
    card.style.top = (card.offsetTop - startY) + "px";
    card.style.left = (card.offsetLeft - startX) + "px";
  }
  function onMouseUp() {
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

export function createHostedCard(card) {
  const img = document.createElement('img');
  img.src = card.src;
  img.alt = card.alt;
  img.classList.add('card');
  img.classList.add('trojan');
  img.style.width = card.w + 'px';
  //img.style.height = card.h + 'px';
  img.style.left = card.x + 'px';
  img.style.top = card.y + 'px';
  makeDraggable(img);
  return img;
}

function hostCard(img, x, y) {
  const container = document.querySelector('#primary-container');
//  img.style.width = pantograph.calibration.pixel.w;
  img.style.left = x + 'px';
  img.style.top = y + 'px';
  container.appendChild(img);
}

export async function startTrojan(e) {
  return new Promise((resolve) => {
    const target = e.target;
    const under = document.querySelector('#primary-container video.live');
    const oldOnClick = under.onclick;
    under.onclick = (e) => {
      under.onclick = oldOnClick;
      resolve({x: e.offsetX, y: e.offsetY});
    };
  });
}
