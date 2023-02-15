import { createPeerConnection, offer, answer } from "./webrtc.js";
import { getCookies, getQueryParams, getComputedDims } from "./utils.js";
import { showModal } from './modals.js';
import { calibrate } from './calibration.js';
import { handleClick } from "./card_search.js";

class Status {
    static Connecting = new Status('Connecting', 'connecting to server', true);
    static Waiting = new Status('Waiting', 'waiting for opponent to join', true);
    static Ready = new Status('Ready', 'ready to start call', false);
    static Listening = new Status('Listening', 'waiting for host to call', true);
    static Offered = new Status('Offered', 'sent offer, waiting for answer', true);
    static Answered = new Status('Answered', 'received answer', false);

    constructor(name, description, busy) {
        this.name = name;
        this.description = description;
        this.busy = busy;
    }
    toString() {
        return `Status.${this.name}`;
    }
    isBusy() {
        return this.busy;
    }
}

function getStatus() {
    return window.state;
}

function changeStatus(newStatus) {
    console.log(`Changing state: ${window.state} -> ${newStatus}`);
    window.state = newStatus;
    const status = document.querySelector('.status span');
    if (status) {
        status.innerHTML = newStatus.description;
        status.setAttribute('aria-busy', newStatus.isBusy());
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

window.addEventListener("load", async (event) => {
    window.state = Status.Connecting;

    let roomId = window.location.pathname.replace('/app/', '');
    console.log(`found room from location: ${roomId}`);

    // this is a hack to avoid cookies (for now?):
    const params = getQueryParams();
    let nickname = params['nickname'];
    let side = params['side'];
    let role = null;

    // either we got here from creating a room (nickname query param)...
    if (nickname) {
        role = 'host';
        await showShareModal(params);
    } else {
        // ... or we got here from a shared link
        role = 'guest';
        let json = await showModal('join-room-modal', ['nickname']);
        nickname = json['nickname'];
        side = json['side'];
    }
    document.body.classList.add(role);

    var socket = io();
    socket.on('connect', function() {
        console.log('connect');
        socket.emit('join', {nickname: nickname, id: roomId, side: side});
        changeStatus(Status.Waiting);
    });
    socket.on('disconnect', function() {
        console.log('disconnect');
        // TODO: update status
    });
    socket.on('offer', async function(data) {
        console.log('offer: ', data);
        changeStatus(Status.Offered);
        await start();
        const pc = await answer(data, socket);
        if (pc != null) {
            window.pc = pc;
            changeStatus(Status.Answered);
        }
    });
    socket.on('answer', async function(data) {
        console.log('answer: ', data);
        changeStatus(Status.Answered);
        window.pc.setRemoteDescription(data);
    });
    socket.on('icecandidate', async function(data) {
        console.log('icecandidate: ', data);
        if (window.pc) {
            window.pc.addIceCandidate(data);
        }
    });
    socket.on('join', function(data) {
        console.log("join", data);
    });
    socket.on('joined', function(data) {
        console.log("joined", data);
        const members = Object.values(data['members']);
        const other = members.some(member => {
            return nickname !== member['nickname'];
        });
        if (other) {
            if (role === 'host') {
                changeStatus(Status.Ready);
            } else {
                changeStatus(Status.Listening);
            }
        }
    });

    (async () => {
        // request extra large constraints initially enables later access to higher res feed?
        // https://stackoverflow.com/questions/61130224/getusermedia-on-chrome-frequently-does-not-return-the-best-resolution
        await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {width:4096,height:2160}
        });
        let devices = await navigator.mediaDevices.enumerateDevices();
        var deviceSelect = document.getElementById('video-device');
        if (devices.length > 0) {
            deviceSelect.remove(0);
        }
        for (var i = 0; i < devices.length; i++) {
            var device = devices[i];
            if (device.kind === "videoinput") {
                console.log(device.label);
                deviceSelect.options.add(new Option(device.label, device.deviceId));
            }
        }
        if (devices.length > 0) {
            // TODO: can status update acquired permissions and found devices here
        }
    })();

    window.start = async function() {
        var device = document.getElementById('video-device').value;
        var constraints = {};
        if (device !== 'loading') {
            constraints.video = { // is having both device ID and width/height meaningful?
                deviceId: device,
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            };
        }

        let stream = await navigator.mediaDevices.getUserMedia(constraints);
        // TODO: can enable a "stop" button here
        let localVideo = document.getElementById('local-video');
        localVideo.srcObject = stream;
        localVideo.play();
        localVideo.addEventListener( "loadedmetadata", function (e) {
            var width = this.videoWidth,
                height = this.videoHeight;
            console.log(`local video: ${width}x${height}`);
        }, false );

        if (getStatus() === Status.Ready) {
            const pc = await offer(socket);
            if (pc != null) {
                changeStatus(Status.Offered);
                window.pc = pc;
            } else {
                // TODO: change state to error
            }
        }
        //document.body.classList.remove('waiting'); // TODO: still relevant?
        document.body.classList.add('local-playing');
    };

    window.stop = function() {
        // TODO
    };

    const callBtn = document.getElementById('call');
    callBtn.onclick = start;

    const calibrateBtn = document.getElementById('calibrate');
    calibrateBtn.onclick = async (e) => {
        let under = document.querySelector('#remote-video');
        let dims = getComputedDims(under);
        let canvas = document.getElementById('calibration-canvas');
        // canvas.style.height = dims.h + "px";
        canvas.style.display = "unset";
        window.calibration = await calibrate(canvas, dims.w, dims.h);
        canvas.style.display = "none";
    };

    let children = document.querySelectorAll('#primary-container .video');
    for (let i = 0; i < children.length; i++) {
        let child = children[i];
        child.addEventListener('click', handleClick);
    }

    for (const [k ,v] of Object.entries(params)) {
        if (k.includes("debug") && v === "true") {
            document.body.classList.add(k);
        }
    }
});
