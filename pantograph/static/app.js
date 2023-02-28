import {getQueryParams, getComputedDims, swapElements} from './utils.js';
import {showModal} from './modals.js';
import {calibrate} from './calibration.js';
import {cardSearch} from './card_search.js';
import {getRoom} from './rooms.js';
import {initializeMetered} from './metered.js';
import {StatusEvent} from './events.js';
import {View} from './view.js';
import {prepareModal} from './modals.js';

class Pantograph {
  modes = {};
  status = {};
  client = null;
  nickname = null;
  side = null;
  format = null;
  room = null;
  calibration = null;
  participants = [];

  constructor(client) {
    this.client = client;
  }

  logEvent(event) {
    if (event.description) {
      console.log(`[${event.key}] ${event.name}`, event.description);
    } else {
      console.log(`[${event.key}] ${event.name}`);
    }
    this.client.onEvent(event);
  }

  updateNickname(nickname) {
    this.nickname = nickname;
  }

  updateSide(newSide) {
    const oldSide = this.side;
    this.side = newSide;
    this.client.onSideChanged(oldSide, newSide);
  }

  updateCalibration(calibration) {
    this.calibration = calibration;
  }

  updateFormat(format) {
    this.format = format;
  }

  addParticipant(joiner) {
    this.participants.push(joiner);
    this.client.onParticipantAdd(joiner);
  }

  updateRoom(data) {
    this.room = data["room"];
    const joiner = data["joiner"];
    const exiter = data["exiter"];
    const hands = ['👋','👋🏻','👋🏼','👋🏽','👋🏾','👋🏿'];
    const hand = hands[Math.floor(Math.random() * hands.length)];
    if (joiner && joiner['nickname'] !== this.nickname) {
      const message = `${joiner['nickname']} joined as ${joiner['side']}`;
      this.logEvent(new StatusEvent('app', 'joined', message, hand, true));
    }
    if (exiter && exiter['nickname'] !== this.nickname) {
      const message = `${exiter['nickname']} left`;
      this.logEvent(new StatusEvent('app', 'exited', message, hand, true));
    }
    const members = Object.values(this.room.members);
    this.client.onParticipantChange(members);
  }

  updateSearchResults(response) {
    this.client.onSearchResult(response);
  }

  initializeModes() {
    const params = getQueryParams();
    for (const [k, v] of Object.entries(params)) {
      if (k.includes('mode') && v === 'true') {
        const mode = k.replace('-mode', '');
        this.modes[mode] = true;
        this.client.onModeEnabled(mode);
      }
    }
  }
  getModes() {
    const result = [];
    for (const [k, v] of Object.entries(this.modes)) {
      if (v) {
        result.push(k);
      }
    }
    return result;
  }
  setMode(mode) {
    this.modes[mode] = true;
    this.client.onModeEnabled(mode);
  }
  unsetMode(mode) {
    this.modes[mode] = false;
    this.client.onModeDisabled(mode);
  }
  isModeOn(mode) {
    return this.modes[mode] === true;
  }
  isDebugOff() {
    const modes = this.getModes();
    return modes.length === 0;
  }

  localVideoStarted(item) {
    const track = item.track;
    const stream = new MediaStream([track]);
    this.client.startPlaying(stream, 'local', 'secondary-container', this.side, (e) => {cardSearch(e, this);});
  }
  remoteVideoStarted(item) {
    console.log('pantograph.remoteVideoStarted');
    const track = item.track;
    const stream = new MediaStream([track]);
    const name = item.participant.name;
    const thatSide = this.room.members[name].side;
    if (this.side === 'spectator') {
      if (thatSide === 'runner') {
        this.client.startPlaying(stream, 'remote', 'primary-container', thatSide, (e) => {cardSearch(e, this);});
      } else if (thatSide === 'corp') {
        this.client.startPlaying(stream, 'local', 'primary-container', thatSide, (e) => {cardSearch(e, this);});
      }
    } else {
      this.client.startPlaying(stream, 'remote', 'primary-container', thatSide, (e) => {cardSearch(e, this);});
    }
  }
  localTrackStopped(item) { }
  remoteTrackStopped(item) { }
}

async function showShareModal(params, debugOff) {
  const input = document.getElementById('share-link-input');
  const location = window.location;
  const newurl = location.protocol + '//' + location.host + location.pathname;
  if (window.history.replaceState && debugOff) {
    window.history.replaceState({path: newurl}, '', newurl);
  }
  input.value = newurl;
  await showModal('share-link-modal');
}

async function showJoinModal(room) {
  document.querySelector('input#corp').checked = false;
  document.querySelector('input#runner').checked = false;
  document.querySelector('input#spectator').checked = false;
  if (room.corp) {
    document.querySelector('input#corp').disabled = true;
  }
  if (room.runner) {
    document.querySelector('input#runner').disabled = true;
  }
  if (room.runner && room.corp) {
    document.querySelector('input#spectator').checked = true;
  }
  return showModal('join-room-modal', ['nickname', 'side']);
}

function initializeSocket(pantograph) {
  const socket = io();
  socket.on('connect', function() {
    pantograph.logEvent(new StatusEvent('socketio', 'connect', 'connected to server', '✅', true));
  });
  socket.on('disconnect', function() {
    pantograph.logEvent(new StatusEvent('socketio', 'disconnect', 'disconnected from server', '⚠️', true));
  });
  socket.on('join', function(data) {
    pantograph.logEvent(new StatusEvent('socketio', 'join', data));
  });
  socket.on('joined', function(data) {
    pantograph.logEvent(new StatusEvent('socketio', 'joined', data));
    pantograph.updateRoom(data);
  });
  socket.on('exited', function(data) {
    pantograph.logEvent(new StatusEvent('socketio', 'exited', data));
    pantograph.updateRoom(data);
  });

  return socket;
}

async function initializeRoom(roomId, pantograph, socket) {
  const room = await getRoom(roomId);

  // this is a hack to avoid cookies (for now?):
  const params = getQueryParams();
  let nickname = params['nickname'];
  let side = params['side'];

  // either we got here from creating a room (nickname query param)...
  if (nickname) {
    await showShareModal(params, pantograph.isDebugOff());
  } else {
    // ... or we got here from a shared link
    // ... or a page reload

    const json = await showJoinModal(room);
    nickname = json['nickname'];
    side = json['side'];
  }
  pantograph.updateNickname(nickname);
  socket.emit('join', {nickname: nickname, room_id: roomId, side: side});

  const format = room['format'];
  pantograph.updateFormat(format);
  let otherSide = null;
  if (side === 'runner') {
    otherSide = 'corp';
  }
  if (side === 'corp') {
    otherSide = 'runner';
  }
  pantograph.updateSide(side);

  return {room, nickname, side, otherSide};
}

function initClickHandlers(pantograph, view) {
  const calibrateButton = document.getElementById('calibrate-button');
  calibrateButton.onclick = async (e) => {
    const under = document.querySelector('#primary-container video.live');
    const dims = getComputedDims(under);
    const canvas = document.getElementById('calibration-canvas');
    const calibration = await calibrate(canvas, dims.w, dims.h);
    pantograph.updateCalibration(calibration);
    canvas.style.display = 'none';
  };

  const swapButton = document.getElementById('swap');
  swapButton.onclick = function() {
    const primary = document.getElementById('primary-container');
    const secondary = document.getElementById('secondary-container');
    const primaryChildren = [];
    for (const child of primary.children) {
      primaryChildren.push(child);
    }
    const secondaryChildren = [];
    for (const child of secondary.children) {
      secondaryChildren.push(child);
    }
    primary.replaceChildren(...secondaryChildren);
    secondary.replaceChildren(...primaryChildren);
  };

  const focusButton = document.getElementById('focus');
  focusButton.onclick = function() {
    const toast = Toastify({
      text: 'tap spacebar to leave focus mode',
      close: false,
      duration: 3000,
      style: {
        background: '#11191f',
        color: 'hsl(205deg, 16%, 77%)'
      },
    });
    function leaveFocus(event) {
      const keyName = event.key;
      if (keyName === ' ') {
        event.preventDefault();
        document.removeEventListener('keypress', leaveFocus);
        toast.hideToast();
        pantograph.unsetMode('focus');
        view.clearCard();
      }
    }
    document.addEventListener('keypress', leaveFocus);
    pantograph.setMode('focus');
    toast.showToast();
  };

  const rdButton = document.getElementById('rd-access');
  rdButton.onclick = function() {
    const toast = Toastify({
      text: 'tap spacebar to leave R&D access mode',
      close: false,
      duration: 3000,
      style: {
        background: '#11191f',
        color: 'hsl(205deg, 16%, 77%)'
      },
    });
    function leaveRD(event) {
      const keyName = event.key;
      if (keyName === ' ') {
        event.preventDefault();
        document.removeEventListener('keypress', leaveRD);
        toast.hideToast();
        pantograph.unsetMode('rdaccess');
      }
    }
    document.addEventListener('keypress', leaveRD);
    pantograph.setMode('rdaccess');
    toast.showToast();
  };

  prepareModal('tutorial-button', 'tutorial-modal');
}

function initCameraButtons(meeting) {
  const startButton = document.getElementById('start-camera');
  startButton.onclick = async function() {
    if (!meeting) {
      console.error('Can\'t start camera: Metered meeting not initialized.');
      return;
    }
    try {
      const deviceId = document.getElementById('video-device').value;
      await meeting.chooseVideoInputDevice(deviceId);
      meeting.startVideo();
      document.body.classList.add('camera-on');
    } catch (ex) {
      console.error('Error occurred when starting camera', ex);
    }
  };
  const stopButton = document.getElementById('stop-camera');
  stopButton.onclick = (function() {
    let paused = false;
    return async function() {
      if (!meeting) {
        console.error('Can\'t pause camera: Metered meeting not initialized.');
        return;
      }
      try {
        if (paused) {
          await meeting.resumeLocalVideo();
          document.body.classList.add('camera-on');
          document.body.classList.remove('camera-off');
        } else {
          await meeting.pauseLocalVideo();
          document.body.classList.add('camera-off');
          document.body.classList.remove('camera-on');
        }
        paused = !paused;
      } catch (ex) {
        console.error('Error occurred when stopping camera', ex);
      }
    };
  })();

}

function setupDemo(pantograph, view) {
  // select a random corp and random runner, unless one passed in query params:
  const runners = ['esâ', 'padma', 'sable'];
  const corps = ['prav', 'thule', 'issuaq', 'ob'];
  let runnerNick = getQueryParams('runner');
  let corpNick = getQueryParams('corp');
  if (!runnerNick) {
    runnerNick = runners[Math.floor(Math.random() * runners.length)];
  }
  if (!corpNick) {
    corpNick = corps[Math.floor(Math.random() * corps.length)];
  }
  const runner = {
    nickname: runnerNick,
    side: 'runner'
  };
  const corp = {
    nickname: corpNick,
    side: 'corp'
  };
  const room = {members: {runnerNick: runner, corpNick: corp}};
  pantograph.updateRoom({room: room});
  pantograph.updateFormat('startup');
  pantograph.updateSide('spectator');

  // between corp/runner, randomly determine local/remote, unless passed in query params:
  const members = [runner, corp];
  let idx = getQueryParams('local');
  if (!idx) {
    idx = Math.round(Math.random());
  } else {
    idx = parseInt(idx);
  }
  const local = members[idx];
  const remote = members[idx < 1 ? 1 : 0];

  function handleClick(e) {
    view.clearCard();
    cardSearch(e, pantograph);
  }
  view.renderVideo(`/video/${remote.nickname}-720p.mp4`, 'remote', 'primary-container', remote.side, handleClick);
  view.renderVideo(`/video/${local.nickname}-720p.mp4`, 'local', 'secondary-container', local.side, handleClick);
}

window.addEventListener('load', async (event) => {
  const view = new View();
  const observer = new class {
    onEvent(event) {
      if (event.toast) {
        const toast = Toastify({
          text: event.emoji + ' ' + event.description,
          close: false,
          duration: 3000,
          style: {
            background: '#11191f',
            color: 'hsl(205deg, 16%, 77%)'
          },
        });
        toast.showToast();
      }
      document.getElementById('debug-event-logs').innerText += (event + '\n');
    }
    onParticipantChange(members) {
      const corp = members.find((m) => m.side === 'corp');
      const runner = members.find((m) => m.side === 'runner');
      const runnerNick = runner ? runner.nickname : '?';
      const corpNick = corp ? corp.nickname : '?';

      const spectators = members.filter((m) => m.side === 'spectator').map((m) => m.nickname);
      const matchText = `${runnerNick} (runner) vs. ${corpNick} (corp)`;
      const plural = spectators.length > 1 ? 's' : '';
      const spectatorText = spectators.length > 0 ? `[${spectators.length} spectator${plural}: ${spectators.join(', ')}]` : '';
      document.getElementById('game-info').innerText = matchText + ' ' + spectatorText;
    }
    onSideChanged(oldSide, newSide) {
      document.body.classList.remove(oldSide);
      document.body.classList.add(newSide);
    }
    onModeEnabled(mode) {
      const root = document.getElementsByTagName('html')[0];
      root.classList.add(mode);
      document.body.classList.add(mode);
      document.querySelector('div.container-fluid').classList.add(mode);
    }
    onModeDisabled(mode) {
      const root = document.getElementsByTagName('html')[0];
      root.classList.remove(mode);
      document.body.classList.remove(mode);
      document.querySelector('div.container-fluid').classList.remove(mode);
    }
    onSearchResult(response) {
      const cards = response.cards;
      const focusMode = pantograph.isModeOn('focus');
      const debugMode = pantograph.isModeOn('debug');
      if (cards.length > 0) {
        for (const card of cards) {
          console.log(`received card(s) from server: ${card.title}`);
        }
      }
      view.renderResults(response, focusMode, debugMode);
    }
    startPlaying(stream, which, container, side, onclick) {
      view.renderVideo(stream, which, container, side, onclick);
    }
  };

  const pantograph = new Pantograph(observer);
  pantograph.initializeModes();

  initClickHandlers(pantograph, view);

  const roomId = window.location.pathname.replace('/app/', '');

  if (roomId === 'demo' || pantograph.isModeOn('demo')) {
    setupDemo(pantograph, view);
    return;
  }

  let socket = initializeSocket(pantograph);
  let {room, nickname, side, otherSide} = await initializeRoom(roomId, pantograph, socket);

  let meeting = null;
  meeting = await initializeMetered(pantograph, nickname, side, room);
  if (meeting === null) {
    pantograph.logEvent(new StatusEvent('Metered', 'nocamera', 'unable to find camera', '❌', true));
  }

  initCameraButtons(meeting);
});
