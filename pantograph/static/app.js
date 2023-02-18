import { getCookies, getQueryParams, getComputedDims, swapElements } from './utils.js';
import { showModal } from './modals.js';
import { calibrate } from './calibration.js';
import { handleClick } from './card_search.js';
import { getRoom } from './rooms.js';
import { initializeMetered } from './metered.js';
import { setModes, getModes, debugOff, isModeOn } from './debug.js';
import { updateMembers } from './status.js';

class Status {
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

function getStatus() {
    return window.status;
}

function changeStatus(newStatus) {
    console.log(`Changing status: ${window.status} -> ${newStatus}`);
    const oldStatus = window.status;
    window.status = newStatus;
    const indicator = document.querySelector('.status span');
    if (indicator) {
        indicator.innerHTML = newStatus.description;
        indicator.setAttribute('aria-busy', newStatus.isBusy());
        document.body.classList.add(newStatus.name);
        document.body.classList.remove(oldStatus.name);
    }
}

async function showShareModal(params) {
    const input = document.getElementById('share-link-input');
    const location = window.location;
    const newurl = location.protocol + '//' + location.host + location.pathname;
    if (window.history.replaceState && debugOff()) {
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
    window.status = Status.Connecting;
    document.body.classList.add(window.status.name);
    setModes();

    let roomId = window.location.pathname.replace('/app/', '');
    let room = await getRoom(roomId);

    // this is a hack to avoid cookies (for now?):
    const params = getQueryParams();
    let nickname = params['nickname'];
    let side = params['side'];

    // either we got here from creating a room (nickname query param)...
    if (nickname) {
        await showShareModal(params);
    } else {
        // ... or we got here from a shared link
        // ... or a page reload

        let json = await showJoinModal(room);
        nickname = json['nickname'];
        side = json['side'];
    }
    window.format = room['format'];
    let otherSide = null;
    if (side === 'runner') {
        otherSide = 'corp';
    }
    if (side === 'corp') {
        otherSide = 'runner';
    }
    document.body.classList.add(side);

    var socket = io();
    socket.on('connect', function() {
        console.log('connect');
        changeStatus(Status.Waiting);
        socket.emit('join', {nickname: nickname, id: roomId, side: side});
    });
    socket.on('disconnect', function() {
        console.log('disconnect');
        changeStatus(Status.Disconnected);
    });
    socket.on('join', function(data) {
        console.log('join', data);
    });
    socket.on('joined', function(data) {
        console.log('joined', data);
        const members = Object.values(data['members']);
        const other = members.some(member => {
            return nickname !== member['nickname'];
        });
        if (other) {
            changeStatus(Status.Ready);
        }
        updateMembers(members);
    });
    socket.on('exited', function(data) {
        console.log('exited', data);
        const members = Object.values(data['members']);
        updateMembers(members);
    });

    let meeting = null;
    if (!isModeOn('demo')) {
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
        window.calibration = await calibrate(canvas, dims.w, dims.h);
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
    if (isModeOn('demo')) {
        remoteVideo.src = `/${otherSide}-720p.mov`;
        localVideo.src = `/${side}-720p.mov`;
        remoteVideo.loop = 'true';
        localVideo.loop = 'true';
        document.body.classList.add('remote-playing');
        document.body.classList.add('local-playing');
    }
});
