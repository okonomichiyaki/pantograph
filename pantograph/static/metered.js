import { showModal } from './modals.js';

function watchResolution(e) {
    let vw,vh;
    setInterval(function() {
        if (e.videoWidth != vw) {
            vw = e.videoWidth;
            vh = e.videoHeight;
            console.log(`remote video resolution changed: ${vw}x${vh}`);
        }
    }, 500);
}

async function getCameraPermissions(meeting) {
    try {
        // ask for permission first, so the labels are populated (Firefox)
        await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {width:4096,height:2160}
        });
        let devices = await meeting.listVideoInputDevices();
        var deviceSelect = document.getElementById('video-device');
        if (devices.length > 0) {
            deviceSelect.remove(0);
        }
        for (let i = 0; i < devices.length; i++) {
            let device = devices[i];
            deviceSelect.options.add(new Option(device.label, device.deviceId));
        }
        if (devices.length === 0) {
            return false;
        }
        return true;
    } catch (e) {
        console.error('[Metered] caught exception', e);
        return false;
    }
}

export async function initializeMetered(pantograph, nickname, side, room) {
    const meeting = new Metered.Meeting();

    if (side !== 'spectator') {
        const successful = await getCameraPermissions(meeting);
        console.log('getCameraPermissions:', successful);
        if (!successful) {
            return null;
        }
    }

    meeting.on('participantJoined', function(participantInfo) {
        console.log('[Metered] participantJoined', participantInfo);
    });
    meeting.on("stateChanged", function(meetingState) {
        console.log('[Metered] stateChanged', meetingState);
        pantograph.changeStatus('metered', meetingState);
        if (meetingState === 'terminated') {
            showModal('terminated-modal');
        }
    });
    meeting.on('localTrackStarted', function(item) {
        console.log('[Metered] localTrackStarted', item);
        if (item.type === 'video') {
            const track = item.track;
            const mediaStream = new MediaStream([track]);
            const localVideo = document.getElementById('local-video');
            localVideo.srcObject = mediaStream;
            document.body.classList.add('local-playing');
        }
    });
    meeting.on('remoteTrackStarted', function(item) {
        console.log('[Metered] remoteTrackStarted', item);
        if (item.type === 'video') {
            const track = item.track;
            const stream = new MediaStream([track]);
            const remoteVideo = document.getElementById('remote-video');
            const localVideo = document.getElementById('local-video');
            if (side === 'spectator') {
                const name = item.participant.name;
                const side = room.members[name].side;
                if (side === 'runner') {
                    remoteVideo.srcObject = stream;
                    remoteVideo.side = 'runner';
                    document.body.classList.add('remote-playing');
                    watchResolution(remoteVideo);
                } else if (side === 'corp') {
                    localVideo.srcObject = stream;
                    localVideo.side = 'corp';
                    document.body.classList.add('local-playing');
                }
            } else {
                remoteVideo.srcObject = stream;
                document.body.classList.add('remote-playing');
                watchResolution(remoteVideo);
            }
        }
    });

    const roomId = room.id;
    const meetingInfo = await meeting.join({
        roomURL: `pantograph.metered.live/${roomId}`,
        name: nickname
    });
    console.log('[Metered] Joined meeting:', meetingInfo);

    return meeting;
}
