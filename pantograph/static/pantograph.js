class State {
    static Connecting = new State('Connecting', 'Connecting to server');
    static Waiting = new State('Waiting', 'Waiting for opponent');
    static Ready = new State('Ready', 'Ready to start call');
    static Offered = new State('Offered', 'Sent offer, waiting for answer');
    static Answered = new State('Answered', 'Received answer');

    constructor(name, description) {
        this.name = name;
        this.description = description;
    }
    toString() {
        return `State.${this.name}`;
    }
}

function getState() {
    return window.state;
}

function changeState(newState) {
    console.log(`Changing state: ${window.state} -> ${newState}`);
    window.state = newState;
}

function getCookies() {
    const cookies = document.cookie.split('; ');
    console.log(cookies);
    const results = {};
    for (let i = 0; i < cookies.length; i++) {
        let cookie = cookies[i];
        let pair = cookie.split('=');
        results[pair[0]] = pair[1];
    }
    return results;
}

function createPeerConnection(socket) {
    let pc = new RTCPeerConnection({
        iceServers: [
            {
                urls: "stun:relay.metered.ca:80",
            },
            {
                urls: "turn:relay.metered.ca:80",
                username: "47055218784c4fa15c43fbcd",
                credential: "WWCMN1njUvk5Pcdb",
            },
            {
                urls: "turn:relay.metered.ca:443",
                username: "47055218784c4fa15c43fbcd",
                credential: "WWCMN1njUvk5Pcdb",
            },
            {
                urls: "turn:relay.metered.ca:443?transport=tcp",
                username: "47055218784c4fa15c43fbcd",
                credential: "WWCMN1njUvk5Pcdb",
            },
        ],
    });
    pc.addEventListener('icecandidate', e => {
//        console.log('icecandidate', e);
        socket.emit('icecandidate', e.candidate);
    });
    pc.addEventListener('iceconnectionstatechange', e => {
        console.log('icecandidatestatechange', e);
    });
    pc.ontrack = function(e) {
        console.log('ontrack', e);
        let remoteVideo = document.getElementById('remote-video');
        if (remoteVideo.srcObject) {
            return;
        }
        remoteVideo.srcObject = new MediaStream([e.track]);
        //remoteVideo.srcObject = e.streams[0];
        remoteVideo.play();
    };
    return pc;
}

async function answer(data, socket) {
    let video = document.getElementById('local-video');
    let stream = video.srcObject;
    const tracks = stream.getVideoTracks();
    if (tracks.length < 1) {
        console.log("Failed to find video tracks");
        return;
    }
    let pc = createPeerConnection(socket);
    window.pc = pc;
    await pc.setRemoteDescription(data);
    pc.addTrack(tracks[0]);
    try {
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        const json = JSON.stringify(answer);
        console.log("Successfully created answer and set local description: ", json);
        socket.emit('answer', answer);
    } catch (e) {
        console.log("Caught exception", e);
    }
}

async function offer(socket) {
    let video = document.getElementById('local-video');
    let stream = video.srcObject;
    const tracks = stream.getVideoTracks();
    if (tracks.length < 1) {
        console.log("Failed to find video tracks");
        return;
    }
    let pc = createPeerConnection(socket);
    pc.addTrack(tracks[0]);
    try {
        const offer = await pc.createOffer({
            offerToReceiveAudio: 0,
            offerToReceiveVideo: 1,
        });
        await pc.setLocalDescription(offer);
        const json = JSON.stringify(offer);
        console.log("Successfully created offer and set local description: ", json);
        socket.emit('offer', offer);
        changeState(State.Offered);
        window.pc = pc;
    } catch (e) {
        console.log("Caught exception", e);
    }
}

window.addEventListener("load", (event) => {
    window.state = State.Connecting;
    let cookies = getCookies();
    let username = cookies["username"];

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
        await answer(data, socket);
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
            document.getElementById('start').style.display = 'inline-block';
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
        document.getElementById('media').style.display = 'block';
        document.getElementById('stop').style.display = 'inline-block';

        if (getState() === State.Ready) {
            await offer(socket);
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

});
