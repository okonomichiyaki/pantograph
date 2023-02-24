export class View {
  cardToast = null;

  clearCard() {
    if (this.cardToast !== null) {
      this.cardToast.hideToast();
      this.cardToast = null;
    }
    const container = document.getElementById('card-container');
    container.replaceChildren();
  }

  #showToast(elt) {
    if (this.cardToast !== null) {
      this.cardToast.hideToast();
    }
    const toast = Toastify({
      node: elt,
      duration: -1,
      close: false,
      stopOnFocus: true,
      style: {
        padding: 0,
        background: "rgba(0,0,0,0)"
      },
      onClick: function(){
        toast.hideToast();
      }
    });
    toast.showToast();
    this.cardToast = toast;
  }

  renderUnknownCard(side, focusMode) {
    const container = document.getElementById('card-container');
    const unknown = document.createElement('div');
    if (side === 'corp') {
      unknown.style.backgroundColor = 'dodgerblue';
    } else {
      unknown.style.backgroundColor = 'crimson';
    }
    unknown.innerHTML = '?';
    unknown.id = 'unknown-card';
    unknown.classList.add('card');
    if (focusMode) {
      this.#showToast(unknown);
    } else {
      container.appendChild(unknown);
    }
  }

  renderKnownCard(card, focusMode) {
    const container = document.getElementById('card-container');
    const img = document.createElement('img');
    const size = 'large';
    img.src = `https://storage.googleapis.com/netrunner-cards/images/${card.code}.jpg`;
    img.alt = card.title;
    img.classList.add('card');

    if (focusMode) {
      this.#showToast(img);
    } else {
      container.appendChild(img);
    }
  }

  renderDebug(response) {
    const b64 = response.img;
    const dataUri = `data:image/jpeg;base64,${b64}`;
    const container = document.getElementById('debug-image-container');
    container.replaceChildren();
    const img = document.createElement('img');
    img.src = dataUri;
    container.appendChild(img);

    if (response.reasons && response.reasons.length > 0) {
      const logs = response.reasons.map(([t, r]) => t + ',' + r).join('\n');
      const display = document.getElementById('debug-search-logs');
      display.innerText = '';
      display.innerText = logs;
    }

    if (response.cards && response.cards.length > 1) {
      const cards = response.cards.slice(1);
      const titles = cards.map((card) => card.title + ',' + card.dist).join('\n');
      const display = document.getElementById('debug-alternates');
      display.innerText = '';
      display.innerText = titles;
    }
  }

  renderVideo(source, which, container, side, onclick) {
    const video = document.createElement('video');
    video.id = which + '-video';
    video.autoPlay = true;
    video.playsInline = true;
    if (typeof source === 'string') {
      video.src = source;
    } else {
      video.srcObject = source;
    }
    video.classList.add('live');
    video.classList.add(side);
    video.side = side;
    const fn = function(e) {
      this.clearCard();
      onclick(e);
    };
    video.onclick = fn.bind(this);
    video.play();
    document.getElementById(container).append(video);
    document.body.classList.add(which + '-playing');
  }
}
