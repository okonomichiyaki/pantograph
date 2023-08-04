import {createHostedCard} from './trojan.js';

const TITLE_HEIGHT = 30;

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

  renderHostedCard(card) {
    const img = createHostedCard(card);
    const container = document.getElementById('primary-container');
    container.appendChild(img);
  }

  renderResults(response, focusMode, debugMode, onclick) {
    if (response.cards.length > 0) {
      if (debugMode) {
        const cards = Array.from(response.cards).reverse();
        for (let i = 0; i < cards.length; i++) {
          const card = cards[i];
          this.renderKnownCard(card, focusMode, i, onclick);
        }
      } else {
        this.renderKnownCard(response.cards[0], focusMode, 0);
      }
      this.renderDebug(response);
    } else {
      this.renderUnknownCard(response.side, focusMode);
    }
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

  renderKnownCard(card, focusMode, idx, onclick) {
    const container = document.getElementById('card-container');
    const img = document.createElement('img');
    const size = 'large';
    img.src = `https://storage.googleapis.com/netrunner-cards/images/${card.code}.jpg`;
    img.alt = card.title;
    img.classList.add('card');
    img.style.top = (idx * TITLE_HEIGHT) + 'px';
    const onMouseLeave = (e) => {
      const imgs = document.querySelectorAll('#card-container img');
      for (const img of imgs) {
        img.style.zIndex = 1;
      }
    };
    const onMouseMove = (e) => {
      onMouseLeave(e);
      if (e.offsetY <= TITLE_HEIGHT) {
        e.target.style.zIndex = 100;
      }
    };
    img.addEventListener("mousemove", onMouseMove);
    img.addEventListener("mouseleave", onMouseLeave);
    img.onclick = onclick;
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
      display.innerText = logs;
    }

    const display = document.getElementById('debug-search-results');
    display.innerText = '';
    if (response.cards && response.cards.length > 0) {
      const cards = response.cards;
      const titles = cards.map((card) => card.title + ',' + card.dist + ',' + card.orig).join('\n');
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
      this.clearCard();// TODO: this causes clicks on the secondary container to clear the searched card--should be a no-op
      onclick(e);
    };
    video.onclick = fn.bind(this);
    video.play();
    document.getElementById(container).append(video);
    document.body.classList.add(which + '-playing');
  }
}
