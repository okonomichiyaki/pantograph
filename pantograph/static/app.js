import {getQueryParams, getComputedDims, swapElements} from './utils.js';
import {showModal} from './modals.js';
import {calibrate} from './calibration.js';
import {cardSearch} from './card_search.js';
import {getRoom} from './rooms.js';
import {initializeMetered} from './metered.js';

class Pantograph {
  modes = {};
  status = {};
  client = null;
  nickname = null;
  side = null;
  format = null;
  calibration = null;

  constructor(client) {
    this.client = client;
    this.status['pantograph'] = Status.Initial;
  }

  changeStatus(key, newStatus) {
    const oldStatus = this.status[key];
    this.status[key] = newStatus;
    this.client.onStatusChange(key, oldStatus, newStatus);
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

  updateRoom(room) {
    const members = Object.values(room.members);
    const other = members.some((member) => {
      return this.nickname !== member['nickname'];
    });
    if (other) {
      this.changeStatus('pantograph', Status.Ready);
    }
    this.client.onParticipantChange(members);
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
}

class Status {
  static Initial = new Status('initial', 'app starting', true);
  static Connecting = new Status('connecting', 'connecting to server', true);
  static Waiting = new Status('waiting', 'waiting for opponent to join', true);
  static Ready = new Status('ready', 'ready to start call', false);
  static Calling = new Status('calling', 'call in progress', false);
  static Disconnected = new Status('disconnected', 'lost connection to server', true);
  static NoCamera = new Status('nocamera', 'unable to find camera ❌', false);
  static Demo = new Status('demo', 'DEMO MODE', false);

  constructor(name, description, busy) {
    this.name = name;
    this.description = description;
    this.busy = busy;
  }
  toString() {
    return this.name;
  }
  isBusy() {
    return this.busy;
  }
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
    console.log('[socketio] connect');
    pantograph.changeStatus('pantograph', Status.Waiting);
  });
  socket.on('disconnect', function() {
    console.log('[socketio] disconnect');
    pantograph.changeStatus('pantograph', Status.Disconnected);
  });
  socket.on('join', function(data) {
    console.log('[socketio] join', data);
  });
  socket.on('joined', function(data) {
    console.log('[socketio] joined', data);
    pantograph.updateRoom(data);
  });
  socket.on('exited', function(data) {
    console.log('[socketio] exited', data);
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
  socket.emit('join', {nickname: nickname, id: roomId, side: side});

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

function initClickHandlers(pantograph) {
  const calibrateButton = document.getElementById('calibrate');
  calibrateButton.onclick = async (e) => {
    const under = document.querySelector('#primary-container video.live');
    const dims = getComputedDims(under);
    const canvas = document.getElementById('calibration-canvas');
    canvas.style.display = 'unset';
    const calibration = await calibrate(canvas, dims.w, dims.h);
    pantograph.updateCalibration(calibration);
    canvas.style.display = 'none';
  };

  const swapButton = document.getElementById('swap');
  swapButton.onclick = function() {
    const remotePlaceholder = document.getElementById('remote-placeholder');
    const localPlaceholder = document.getElementById('local-placeholder');
    swapElements(remotePlaceholder, localPlaceholder);
    const remoteVideo = document.getElementById('remote-video');
    const localVideo = document.getElementById('local-video');
    swapElements(remoteVideo, localVideo);
  };

  const focusButton = document.getElementById('focus');
  focusButton.onclick = function() {
    //const video = document.querySelector('#primary-container video.live');
    function leaveFocus(event) {
      const keyName = event.key;
      console.log(`keyName=${keyName}`, event);
      if (keyName === ' ') {
        document.removeEventListener('keypress', leaveFocus);
        pantograph.unsetMode('focus');
      }
    }
    document.addEventListener('keypress', leaveFocus);
    pantograph.setMode('focus');
  };

  function handleSearchClick(e) {
    cardSearch(e, pantograph);
  }
  const children = document.querySelectorAll('video.live');
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    child.addEventListener('click', handleSearchClick);
  }
}

function initCameraButton(meeting) {
  const camButton = document.getElementById('camera');
  camButton.onclick = async function() {
    if (!meeting) {
      console.error('Can\' start camera: Metered meeting not initialized.');
      return;
    }
    try {
      const deviceId = document.getElementById('video-device').value;
      await meeting.chooseVideoInputDevice(deviceId);
      meeting.startVideo();
    } catch (ex) {
      console.log('Error occurred when sharing camera', ex);
    }
  };
}

function setupDemo(pantograph) {
  // select a random corp and random runner, unless one passed in query params:
  const runners = ['esâ', 'padma'];
  const corps = ['prav', 'thule', 'issuaq'];
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
  pantograph.updateRoom({members: {runnerNick: runner, corpNick: corp}});
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

  const remoteVideo = document.querySelector('#remote-video');
  const localVideo = document.querySelector('#local-video');
  remoteVideo.side = remote.side;
  localVideo.side = local.side;
  remoteVideo.src = `/video/${remote.nickname}-720p.mp4`;
  localVideo.src = `/video/${local.nickname}-720p.mp4`;
  remoteVideo.loop = 'true';
  localVideo.loop = 'true';
  document.body.classList.add('remote-playing');
  document.body.classList.add('local-playing');

  pantograph.changeStatus('pantograph', Status.Demo);
}

window.addEventListener('load', async (event) => {
  const observer = new class {
    onStatusChange(key, oldStatus, newStatus) {
      console.log(`[observer] onStatusChange: ${key} ${oldStatus} -> ${newStatus}`);
      const indicator = document.querySelector(`.status span#${key}`);
      if (indicator && newStatus.name) {
        indicator.innerHTML = newStatus.description;
        indicator.setAttribute('aria-busy', newStatus.isBusy());
        document.body.classList.add(newStatus.name);
        if (oldStatus) {
          document.body.classList.remove(oldStatus.name);
        }
      }
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
      // const root = document.getElementsByTagName('html')[0];
      // root.setAttribute('class', mode);
      document.body.classList.add(mode);
      document.querySelector('div.container-fluid').classList.add(mode);
    }
    onModeDisabled(mode) {
      // const root = document.getElementsByTagName('html')[0];
      // root.setAttribute('class', mode);
      document.body.classList.remove(mode);
      document.querySelector('div.container-fluid').classList.remove(mode);
    }
  };

  const pantograph = new Pantograph(observer);
  pantograph.changeStatus('pantograph', Status.Connecting);
  pantograph.initializeModes();

  initClickHandlers(pantograph);

  const roomId = window.location.pathname.replace('/app/', '');

  if (roomId === 'demo' || pantograph.isModeOn('demo')) {
    setupDemo(pantograph);
    return;
  }

  let socket = initializeSocket(pantograph);
  let {room, nickname, side, otherSide} = await initializeRoom(roomId, pantograph, socket);

  let meeting = null;
  meeting = await initializeMetered(pantograph, nickname, side, room);
  if (meeting === null) {
    // TODO: differentiate between failed to get camera, and failure with Metered API
    pantograph.changeStatus('metered', Status.NoCamera);
  }

  initCameraButton(meeting);

  if (side !== 'spectator') {
    const remoteVideo = document.querySelector('#remote-video');
    const localVideo = document.querySelector('#local-video');
    remoteVideo.side = otherSide;
    localVideo.side = side;
  }
});
