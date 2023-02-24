import {showModal} from './modals.js';
import {Status} from './status.js';

function startPlaying(stream, which, container, side) {
  const video = document.createElement('video');
  video.id = which + '-video';
  video.autoPlay = true;
  video.playsInline = true;
  video.srcObject = stream;
  video.classList.add('live');
  video.classList.add(side);
  video.side = side;
  video.play();
  document.getElementById(container).append(video);
  document.body.classList.add(which + '-playing');
}

function stopPlaying(which) {
  document.getElementById(which + '-video').remove();
  document.body.classList.remove(which + '-playing');
}

function watchResolution(e) {
  let vw; let vh;
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
      video: {width: 4096, height: 2160},
    });
    const devices = await meeting.listVideoInputDevices();
    const deviceSelect = document.getElementById('video-device');
    if (devices.length > 0) {
      deviceSelect.remove(0);
    }
    for (let i = 0; i < devices.length; i++) {
      const device = devices[i];
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
  meeting.on('stateChanged', function(meetingState) {
    console.log('[Metered] stateChanged', meetingState);

    if (meetingState === 'terminated') {
      showModal('terminated-modal');
      // TODO: this is a terminal state and should stop video streams?
    }
  });
  meeting.on('localTrackStarted', function(item) {
    console.log('[Metered] localTrackStarted', item);
    if (item.type === 'video') {
      pantograph.localVideoStarted(item);
    }
  });
  meeting.on('remoteTrackStarted', function(item) {
    console.log('[Metered] remoteTrackStarted', item);
    if (item.type === 'video') {
      pantograph.remoteVideoStarted(item);
    }
  });
  meeting.on('localTrackStopped', function(item) {
    console.log('[Metered] localTrackStopped', item);
    stopPlaying('local');
  });
  meeting.on('remoteTrackStopped', function(item) {
    console.log('[Metered] remoteTrackStopped', item);
    stopPlaying('remote');
  });

  const roomId = room.id;
  const meetingInfo = await meeting.join({
    roomURL: `pantograph.metered.live/${roomId}`,
    name: nickname,
  });
  console.log('[Metered] Joined meeting:', meetingInfo);

  return meeting;
}
