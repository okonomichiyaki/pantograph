import { createPeerConnection, offer, answer } from "./webrtc.js";
import { getCookies, getQueryParams, getComputedDims, cropFromVideo } from "./utils.js";
import { showModal } from './modals.js';
import { handleClick } from "./card_search.js";

class Status {
    static Connecting = new Status('Connecting', 'connecting to server', true);
    static Waiting = new Status('Waiting', 'waiting for opponent', true);
    static Ready = new Status('Ready', 'ready to start call', false);
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

window.addEventListener("load", async (event) => {
    window.state = Status.Connecting;

    // either we got here from creating a room (query param contains nickname)...
    let roomId = window.location.pathname.replace('/app/', '');
    console.log(`found room from location: ${roomId}`);
    let nickname = getQueryParams('nickname');
    if (nickname) {
        var newurl = window.location.protocol + '//' + window.location.host + window.location.pathname;
        window.history.replaceStatus({path: newurl}, '', newurl);
        const input = document.getElementById('share-link-input');
        input.value = newurl;
        await showModal('share-link-modal');
    }

    // ... or we got here from a shared link
    if (!nickname) {
        let json = await showModal('join-room-modal', ['nickname']);
        nickname = json['nickname'];
    }

    var socket = io();
    socket.on('connect', function() {
        console.log('connect');
        socket.emit('join', {nickname: nickname, id: roomId});
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
            changeStatus(Status.Ready);
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
//        document.body.classList.remove('waiting');
        document.body.classList.add('local-playing');
    };

    window.stop = function() {
        // TODO
    };

    const callBtn = document.getElementById('call');
    callBtn.onclick = start;

    let primary = document.getElementById('primary-container');
    let children = primary.children;
    for (let i = 0; i < children.length; i++) {
        let child = children[i];
        console.log(child);
        child.addEventListener('click', handleClick);
    }

    const params = getQueryParams();
    for (const [k ,v] of Object.entries(params)) {
        if (k.includes("debug") && v === "true") {
            document.body.classList.add(k);
        }
    }
});
