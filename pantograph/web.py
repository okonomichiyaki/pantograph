import argparse
import asyncio
import json
import logging
import os
import ssl
import uuid

import cv2 as cv
from aiohttp import web
from av import VideoFrame

from aiortc import MediaStreamTrack, RTCPeerConnection, RTCSessionDescription
from aiortc.contrib.media import MediaBlackhole, MediaPlayer, MediaRecorder, MediaRelay

from pantograph.detect import Detector
from pantograph.drawing import draw

ROOT = os.path.dirname(__file__)

logger = logging.getLogger("pantograph")


pcs = set()
relay = MediaRelay()
channel = None
card_search = None


def create_message(message_type, details=None):
    payload = {"type": message_type, "details": details}
    logger.debug(f"payload={payload}")
    encoded = json.dumps(payload)
    logger.debug(f"encoded={encoded}")
    return encoded

class VideoTransformTrack(MediaStreamTrack):
    """
    A video stream track that transforms frames from an another track.
    """

    kind = "video"

    def __init__(self, track, card_search):
        super().__init__()  # don't forget this!
        self.track = track
        backsub = cv.createBackgroundSubtractorMOG2()
        self.detector = Detector(backsub, card_search)
        self._height = 0

    async def recv(self):
        global channel
        global card_search
        frame = await self.track.recv()
        try:
            img = frame.to_ndarray(format="bgr24")
            height, width = img.shape[:2]
            if height != self._height and height > self._height:
                logger.debug(f"video warming up: {width}x{height}")
                self._height = height
                channel.send(create_message("warmup", height))
            if height != self._height and height < self._height:
                logger.debug(f"video degrading: {width}x{height}")
                self._height = height
                channel.send(create_message("degrade", height))
            if height >= 720:
#            if height == 1080:
                output = img.copy()
                state = self.detector.detect(img)
                draw(state, output)
                new_frame = VideoFrame.from_ndarray(output, format="bgr24")
                new_frame.pts = frame.pts
                new_frame.time_base = frame.time_base
                if state.change and len(state.locked_cards) > 0:
                    cards = [card.to_dict() for card in state.locked_cards]
                    logger.debug(f"cards={cards}")
                    message = create_message("cards", cards)
                    logger.debug(f"message={message}")
                    channel.send(message)
                return new_frame
        except Exception as e:
            logger.error(f"recv caught exception: {e}")
        return frame

async def index(request):
    content = open(os.path.join(ROOT, "index.html"), "r").read()
    return web.Response(content_type="text/html", text=content)


async def javascript(request):
    content = open(os.path.join(ROOT, "client.js"), "r").read()
    return web.Response(content_type="application/javascript", text=content)


async def offer(request):
    params = await request.json()
    offer = RTCSessionDescription(sdp=params["sdp"], type=params["type"])

    pc = RTCPeerConnection()
    pc_id = "PeerConnection(%s)" % uuid.uuid4()
    pcs.add(pc)

    def log_info(msg, *args):
        logger.info(pc_id + " " + msg, *args)

    log_info("Created for %s", request.remote)

    @pc.on("datachannel")
    def on_datachannel(c):
        global channel
        channel = c
        @c.on("message")
        def on_message(message):
            if isinstance(message, str) and message.startswith("ping"):
                c.send("pong" + message[4:])

    @pc.on("connectionstatechange")
    async def on_connectionstatechange():
        log_info("Connection state is %s", pc.connectionState)
        if pc.connectionState == "failed":
            await pc.close()
            pcs.discard(pc)

    @pc.on("track")
    def on_track(track):
        log_info("Track %s received", track.kind)

        if track.kind == "video":
            pc.addTrack(VideoTransformTrack(relay.subscribe(track), card_search))

        @track.on("ended")
        async def on_ended():
            log_info("Track %s ended", track.kind)

    # handle offer
    await pc.setRemoteDescription(offer)

    # send answer
    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    return web.Response(
        content_type="application/json",
        text=json.dumps(
            {"sdp": pc.localDescription.sdp, "type": pc.localDescription.type}
        ),
    )


async def on_shutdown(app):
    # close peer connections
    coros = [pc.close() for pc in pcs]
    await asyncio.gather(*coros)
    pcs.clear()


def run(args, cs):
    global card_search
    card_search = cs
    app = web.Application()
    app.on_shutdown.append(on_shutdown)
    app.router.add_get("/", index)
    app.router.add_get("/client.js", javascript)
    app.router.add_post("/offer", offer)
    web.run_app(
        app, access_log=None, host=args.host, port=args.port, ssl_context=None
    )
