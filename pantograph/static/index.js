import {prepareModal} from './modals.js';

function createNewRoom(json) {
  if (!json) {
    return;
  }
  const nickname = json['nickname'];
  const side = json['side'];

  // in demo mode, backend will not create a Metered room:
  if (window.location.search.includes('demo-mode=true')) {
    json['demo'] = true;
  }

  const str = JSON.stringify(json);
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: str,
  };
  fetch('/room', options)
      .then((response) => response.json())
      .then((response) => {
        const id = response['id'];
        const path = `/app/${id}`;
        let params = `nickname=${nickname}&side=${side}`;

        // if there are any modes, pass them through:
        if (window.location.search.includes('mode')) {
          params = window.location.search + '&' + params;
        } else {
          params = '?' + params;
        }

        window.location.href = path + params;
      })
      .catch((err) => console.error(err));
}

window.addEventListener('load', (event) => {
  prepareModal('new-room-button', 'new-room-modal', createNewRoom, ['nickname', 'format', 'side']);
  const screenshots = [
    'demo-esa-prav.png',
    'demo-padma-prav.png',
    'demo-esa-thule.png',
    'demo-padma-issuaq.png'
  ];
  const screenshot = screenshots[Math.floor(Math.random() * screenshots.length)];
  const img = document.getElementById('screenshot');
  img.src = '/images/' + screenshot;
  img.style.display = 'block';
});
