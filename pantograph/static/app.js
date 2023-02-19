import { getCookies, getQueryParams, getComputedDims, swapElements } from './utils.js';
import { showModal } from './modals.js';
import { calibrate } from './calibration.js';
import { cardSearch } from './card_search.js';
import { getRoom } from './rooms.js';
import { initializeMetered } from './metered.js';

class Pantograph {
    modes = {};
    client = null;
    status = null;
    nickname = null;
    side = null;
    format = null;
    calibration = null;

    constructor(client) {
        this.client = client;
        this.status = Status.Initial;
    }

    changeStatus(newStatus) {
        const oldStatus = this.status;
        this.status = newStatus;
        this.client.onStatusChange(oldStatus, newStatus);
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
        const other = members.some(member => {
            return this.nickname !== member['nickname'];
        });
        if (other) {
            this.changeStatus(Status.Ready);
        }
        this.client.onParticipantChange(members);
    }

    initializeModes() {
        const params = getQueryParams();
        for (const [k ,v] of Object.entries(params)) {
            if (k.includes('mode') && v === 'true') {
                const mode = k.replace('-mode', '');
                this.modes[mode] = true;
                this.client.onModeEnabled(mode);
            }
        }
    }
    getModes() {
        const result = [];
        for (const [k ,v] of Object.entries(this.modes)) {
            if (v) { result.push(k); }
        }
        return result;
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

window.addEventListener('load', async (event) => {
    const observer = new class {
        onStatusChange(oldStatus, newStatus) {
            console.log(`[observer] onStatusChange: ${oldStatus} -> ${newStatus}`);
            const indicator = document.querySelector('.status span');
            if (indicator) {
                indicator.innerHTML = newStatus.description;
                indicator.setAttribute('aria-busy', newStatus.isBusy());
                document.body.classList.add(newStatus.name);
                document.body.classList.remove(oldStatus.name);
            }
        }
        onParticipantChange(members) {
            const corp = members.find(m => m.side === 'corp');
            const runner = members.find(m => m.side === 'runner');
            const runnerNick = runner ? runner.nickname : '?';
            const corpNick = corp ? corp.nickname : '?';

            const spectators = members.filter(m => m.side === 'spectator').map(m => m.nickname);
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
            document.body.classList.add(mode);
        }
    };
    const pantograph = new Pantograph(observer);
    pantograph.changeStatus(Status.Connecting);
    pantograph.initializeModes();

    var socket = io();
    socket.on('connect', function() {
        console.log('[socketio] connect');
        pantograph.changeStatus(Status.Waiting);
    });
    socket.on('disconnect', function() {
        console.log('[socketio] disconnect');
        pantograph.changeStatus(Status.Disconnected);
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

    let roomId = window.location.pathname.replace('/app/', '');
    let room = await getRoom(roomId);

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

        let json = await showJoinModal(room);
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

    let meeting = null;
    if (!pantograph.isModeOn('demo')) {
        meeting = await initializeMetered(nickname, side, room);
    }

    const camButton = document.getElementById('camera');
    camButton.onclick = async function() {
        if (!meeting) {
            console.error('Can\' start camera: Metered meeting not initialized.');
            return;
        }
        try {
            var deviceId = document.getElementById('video-device').value;
            await meeting.chooseVideoInputDevice(deviceId);
            meeting.startVideo();
        } catch (ex) {
            console.log('Error occurred when sharing camera', ex);
        }
    };
    const calibrateButton = document.getElementById('calibrate');
    calibrateButton.onclick = async (e) => {
        let under = document.querySelector('#primary-container video.live');
        let dims = getComputedDims(under);
        let canvas = document.getElementById('calibration-canvas');
        canvas.style.display = 'unset'; // TODO should this be display block?
        const calibration = await calibrate(canvas, dims.w, dims.h);
        pantograph.updateCalibration(calibration);
        canvas.style.display = 'none';
    };
    const swapButton =  document.getElementById('swap');
    swapButton.onclick = function() {
        const remotePlaceholder = document.getElementById('remote-placeholder');
        const localPlaceholder = document.getElementById('local-placeholder');
        swapElements(remotePlaceholder, localPlaceholder);
        const remoteVideo = document.getElementById('remote-video');
        const localVideo = document.getElementById('local-video');
        swapElements(remoteVideo, localVideo);
    };

    function handleClick(e) {
        cardSearch(e, pantograph.calibration, pantograph.format);
    }
    let children = document.querySelectorAll('video.live');
    for (let i = 0; i < children.length; i++) {
        let child = children[i];
        child.addEventListener('click', handleClick);
    }

    const remoteVideo = document.querySelector('#remote-video');
    const localVideo = document.querySelector('#local-video');
    if (side !== 'spectator') {
        remoteVideo.side = otherSide;
        localVideo.side = side;
    }
    if (pantograph.isModeOn('demo')) {
        remoteVideo.src = `/${otherSide}-720p.mov`;
        localVideo.src = `/${side}-720p.mov`;
        remoteVideo.loop = 'true';
        localVideo.loop = 'true';
        document.body.classList.add('remote-playing');
        document.body.classList.add('local-playing');
    }
});
