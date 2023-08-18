import {showModal} from './modals.js';
import {StatusEvent} from './events.js';

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
    if (!successful) {
      return null;
    }
  }

  meeting.on('participantJoined', function(participantInfo) {
    pantograph.logEvent(new StatusEvent('Metered', 'participantJoined', participantInfo));
  });
  meeting.on("participantLeft", function(participantInfo) {
    pantograph.logEvent(new StatusEvent('Metered', 'participantLeft', participantInfo));
  });
  meeting.on('stateChanged', function(meetingState) {
    pantograph.logEvent(new StatusEvent('Metered', 'stateChanged', meetingState));

    if (meetingState === 'terminated') {
      showModal('terminated-modal');
      // TODO: this is a terminal state and should stop video streams?
    }
  });
  meeting.on('localTrackStarted', function(item) {
    pantograph.logEvent(new StatusEvent('Metered', 'localTrackStarted', item));
    if (item.type === 'video') {
      pantograph.localVideoStarted(item);
    }
  });
  meeting.on('remoteTrackStarted', function(item) {
    pantograph.logEvent(new StatusEvent('Metered', 'remoteTrackStarted', item));
    if (item.type === 'video') {
      pantograph.remoteVideoStarted(item);
    }
  });
  meeting.on('localTrackStopped', function(item) {
    pantograph.logEvent(new StatusEvent('Metered', 'localTrackStopped', item));
    stopPlaying('local');
  });
  meeting.on('remoteTrackStopped', function(item) {
    pantograph.logEvent(new StatusEvent('Metered', 'remoteTrackStopped', item));
    stopPlaying('remote');
  });

  const roomId = room.room_id;
  const meetingInfo = await meeting.join({
    roomURL: `pantograph.metered.live/${roomId}`,
    name: nickname,
  });

  return meeting;
}
