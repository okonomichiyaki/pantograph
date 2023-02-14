import { createPeerConnection, offer, answer } from "./webrtc.js";
import { getCookies, getQueryParams, getComputedDims, cropFromVideo } from "./utils.js";
import { handleClick } from "./card_search.js";

class State {
    static Connecting = new State('Connecting', 'connecting to server...');
    static Waiting = new State('Waiting', 'waiting for opponent...');
    static Ready = new State('Ready', 'ready to start call...');
    static Offered = new State('Offered', 'sent offer, waiting for answer...');
    static Answered = new State('Answered', 'received answer...');

    constructor(name, description) {
        this.name = name;
        this.description = description;
    }
    toString() {
        return `State.${this.name}`;
    }
    isBusy() {
        return true;
    }
}

function getState() {
    return window.state;
}

function changeState(newState) {
    console.log(`Changing state: ${window.state} -> ${newState}`);
    window.state = newState;
    const status = document.querySelectorAll('.status span');
    if (status.length > 0) {
        status[0].innerHTML = newState.description;
        status[0].setAttribute('aria-busy', newState.isBusy());
    }
}

window.addEventListener("load", (event) => {
    window.state = State.Connecting;
    let cookies = getCookies();
    let username = cookies["username"];
    console.log("username="+username);

    var socket = io();
    socket.on('connect', function() {
        console.log('connect');
        socket.emit('join', {username: username});
        changeState(State.Waiting);
    });
    socket.on('disconnect', function() {
        console.log('disconnect');
    });
    socket.on('offer', async function(data) {
        console.log('offer: ', data);
        changeState(State.Offered);
        await start();
        const pc = await answer(data, socket);
        if (pc != null) {
            window.pc = pc;
            changeState(State.Answered);
        }
    });
    socket.on('answer', async function(data) {
        console.log('answer: ', data);
        changeState(State.Answered);
        window.pc.setRemoteDescription(data);
    });
    socket.on('icecandidate', async function(data) {
        console.log('icecandidate: ', data);
        if (window.pc) {
            window.pc.addIceCandidate(data);
        }
    });
    socket.on('join', function(data) {
        if (data['username'] !== username) {
            console.log(`${data['username']} joined`);
            changeState(State.Ready);
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

        if (getState() === State.Ready) {
            const pc = await offer(socket);
            if (pc != null) {
                changeState(State.Offered);
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
