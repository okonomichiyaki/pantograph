import { createPeerConnection, offer, answer } from "./webrtc.js";
import { getCookies } from "./utils.js";

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
        window.pc.addIceCandidate(data);
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
//            document.getElementById('start').style.display = 'inline-block';
        }
    })();

    window.start = async function() {
        let localVideo = document.getElementById('local-video');
        let remoteVideo = document.getElementById('remote-video');
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
        localVideo.srcObject = stream;
        localVideo.play();
        // document.getElementById('media').style.display = 'block';
        // document.getElementById('stop').style.display = 'inline-block';

        if (getState() === State.Ready) {
            const pc = await offer(socket);
            if (pc != null) {
                changeState(State.Offered);
                window.pc = pc;
            } else {
                // TODO: change state to error
            }
        }

        let click = function(event) {
            let x = event.offsetX;
            let y = event.offsetY;
            const w = 300;
            const h = 300;

            let target = event.target;
            // crop the video feed:
            let output = document.getElementById('output');
            let ctx = output.getContext('2d');
            ctx.drawImage(target, 0, 0, output.width, output.height);
            ctx.strokeStyle = "rgb(0, 255, 0)";
            ctx.strokeRect(x - w / 2, y - h / 2, w, h);
            let imageData = ctx.getImageData(x - w / 2, y - h / 2, w, h);
            let crop = document.createElement("canvas");
            crop.width = w;
            crop.height = h;
            let cropctx = crop.getContext("2d");
            cropctx.rect(0, 0, w, h);
            cropctx.fillStyle = 'white';
            cropctx.fill();
            cropctx.putImageData(imageData, 0, 0);

            // POST to server:
            const data = crop.toDataURL();
            const json = {'image': data};
            const options = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(json)
            };
            fetch('/recognize', options)
                .then(response => response.json())
                .then(response => {
                    console.log(response);
                    let container = document.getElementById('card-container');
                    container.replaceChildren();
                    if (response.length > 0) {
                        let card = response[0];
                        // update card image:
                        var img = document.createElement('img');
                        var size = "large";
                        img.src = "https://static.nrdbassets.com/v1/" + size + "/" + card.code + ".jpg";
                        container.appendChild(img);
                    } else {
                        let unknown = document.createElement('p');
                        unknown.innerHTML = "?";
                        container.appendChild(unknown);
                    }
                })
                .catch(err => console.error(err));
        };
        localVideo.addEventListener('click', click);
        remoteVideo.addEventListener('click', click);
    };

    window.stop = function() {
        // TODO
    };

    const callBtn = document.getElementById('call');
    callBtn.onclick = start;

});
