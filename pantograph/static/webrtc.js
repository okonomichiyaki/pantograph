export function createPeerConnection(socket) {
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
        // console.log('icecandidate', e);
        socket.emit('icecandidate', e.candidate);
    });
    pc.addEventListener('iceconnectionstatechange', e => {
        // console.log('icecandidatestatechange', e);
    });
    pc.ontrack = function(e) {
        // console.log('ontrack', e);
        let remoteVideo = document.getElementById('remote-video');
        if (remoteVideo.srcObject) {
            return;
        }
        remoteVideo.srcObject = new MediaStream([e.track]);
        remoteVideo.play();
        remoteVideo.addEventListener( "loadedmetadata", function (e) {
            var width = this.videoWidth,
                height = this.videoHeight;
            console.log(`remote video: ${width}x${height}`);
        }, false );
        document.body.classList.add('remote-playing');
    };
    return pc;
}

export async function answer(data, socket) {
    let video = document.getElementById('local-video');
    let stream = video.srcObject;
    const tracks = stream.getVideoTracks();
    if (tracks.length < 1) {
        console.log("Failed to find local video tracks");
        return null;
    }
    let pc = createPeerConnection(socket);
    await pc.setRemoteDescription(data);
    pc.addTrack(tracks[0]);
    try {
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        const json = JSON.stringify(answer);
        console.log("Successfully created answer and set local description. Sending answer: ", json);
        socket.emit('answer', answer);
        return pc;
    } catch (e) {
        console.log("Caught exception handling answer:", e);
    }
    return null;
}

export async function offer(socket) {
    let video = document.getElementById('local-video');
    let stream = video.srcObject;
    const tracks = stream.getVideoTracks();
    if (tracks.length < 1) {
        console.log("Failed to find video tracks");
        return null;
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
        return pc;
    } catch (e) {
        console.log("Caught exception", e);
    }
    return null;
}
