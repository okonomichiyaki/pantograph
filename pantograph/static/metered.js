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
        if (devices.length > 0) {
            // TODO: can status update acquired permissions and found devices here
            return false;
        }
        return true;
    } catch (e) {
        console.error('caught exception', e);
        return false;
    }
}

export async function initializeMetered(nickname, side, room) {
    const meeting = new Metered.Meeting();

    if (side !== 'spectator') {
        getCameraPermissions(meeting);
    }

    const roomId = room.id;
    const meetingInfo = await meeting.join({
        roomURL: `pantograph.metered.live/${roomId}`,
        name: nickname
    });
    console.log('[Metered] Joined meeting:', meetingInfo);
    meeting.on('participantJoined', function(participantInfo) {
        console.log('[Metered] participantJoined', participantInfo);
    });
    meeting.on('localTrackStarted', function(item) {
        console.log('[Metered] localTrackStarted', item);
        if (item.type === 'video') {
            var track = item.track;
            var mediaStream = new MediaStream([track]);
            document.getElementById('local-video').srcObject = mediaStream;
            document.body.classList.add('local-playing');
        }
    });
    meeting.on('remoteTrackStarted', function(item) {
        console.log('[Metered] remoteTrackStarted', item);
        if (item.type === 'video') {
            var track = item.track;
            var stream = new MediaStream([track]);
            if (side === 'spectator') {
                const name = item.participant.name;
                const side = room.members[name].side;
                if (side === 'runner') {
                    document.getElementById('remote-video').srcObject = stream;
                    document.getElementById('remote-video').side = 'runner';
                    document.body.classList.add('remote-playing');
                } else if (side === 'corp') {
                    document.getElementById('local-video').srcObject = stream;
                    document.getElementById('local-video').side = 'corp';
                    document.body.classList.add('local-playing');
                }
            } else {
                document.getElementById('remote-video').srcObject = stream;
                document.body.classList.add('remote-playing');
            }
        }
    });

    return meeting;
}
