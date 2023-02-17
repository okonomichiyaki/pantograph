import { getCookies, getQueryParams, getComputedDims } from './utils.js';
import { showModal } from './modals.js';
import { calibrate } from './calibration.js';
import { handleClick } from './card_search.js';
import { getRoom } from './rooms.js';

class Status {
    static Connecting = new Status('connecting', 'connecting to server', true);
    static Waiting = new Status('waiting', 'waiting for opponent to join', true);
    static Ready = new Status('ready', 'ready to start call', false);
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
    if (window.history.replaceState && !params['debug']) {
        window.history.replaceState({path: newurl}, '', newurl);
    }
    input.value = newurl;
    await showModal('share-link-modal');
}

window.addEventListener('load', async (event) => {
    window.status = Status.Connecting;
    document.body.classList.add(window.status.name);

    let roomId = window.location.pathname.replace('/app/', '');
    let room = await getRoom(roomId);
    let freeSide = null;
    if (room.corp) {
        freeSide = 'runner';
    }
    if (room.runner) {
        freeSide = 'corp';
    }

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

        // TODO: will need to fix when adding spectator mode:
        const header = document.querySelector('dialog#join-room-modal header');
        if (header && freeSide) {
            header.innerHTML = `joining room as ${freeSide}`;
        }

        let json = await showModal(
            'join-room-modal',
            ['nickname'],
            {side: {value: freeSide, disabled: true}}
        );
        nickname = json['nickname'];
        side = json['side'];
    }

    var socket = io();
    socket.on('connect', function() {
        console.log('connect');
        changeStatus(Status.Waiting);
        socket.emit('join', {nickname: nickname, id: roomId, side: freeSide});
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
    });

    const meeting = new Metered.Meeting();
    const meetingInfo = await meeting.join({
        roomURL: `pantograph.metered.live/${roomId}`,
        name: nickname
    });
    console.log('Joined meeting:', meetingInfo);
    meeting.on('localTrackStarted', function(item) {
        console.log('[Metered] localTrackStarted', item);
        if (item.type === 'video') {
            var track = item.track;
            var mediaStream = new MediaStream([track]);
            document.getElementById('local-video').srcObject = mediaStream;
            document.getElementById('local-video').play();
            document.body.classList.add('local-playing');
        }
    });
    meeting.on('participantJoined', function(participantInfo) {
        console.log('[Metered] participantJoined', participantInfo);
    });
    meeting.on('remoteTrackStarted', function(item) {
        console.log('[Metered] remoteTrackStarted', item);
        var track = item.track;
        var stream = new MediaStream([track]);
        const videoTag = document.getElementById('remote-video');
        videoTag.srcObject = stream;
        document.body.classList.add('remote-playing');
    });

    window.stop = function() {
        // TODO
    };

    const callButton = document.getElementById('call');
    callButton.onclick = async function() {
        try {
            meeting.startVideo();
        } catch (ex) {
            console.log('Error occurred when sharing camera', ex);
        }
    };

    const calibrateButton = document.getElementById('calibrate');
    calibrateButton.onclick = async (e) => {
        let under = document.querySelector('#remote-video');
        let dims = getComputedDims(under);
        let canvas = document.getElementById('calibration-canvas');
        canvas.style.display = 'unset';
        window.calibration = await calibrate(canvas, dims.w, dims.h);
        canvas.style.display = 'none';
    };

    let children = document.querySelectorAll('#primary-container .video');
    for (let i = 0; i < children.length; i++) {
        let child = children[i];
        child.addEventListener('click', handleClick);
    }

    for (const [k ,v] of Object.entries(params)) {
        if (k.includes('debug') && v === 'true') {
            document.body.classList.add(k);
        }
    }
});
