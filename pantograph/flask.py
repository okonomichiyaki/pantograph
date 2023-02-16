from flask import Flask, send_file, request, jsonify
from flask_socketio import SocketIO, join_room, leave_room
from flask_httpauth import HTTPBasicAuth
from werkzeug.security import generate_password_hash, check_password_hash

import logging
from urllib.request import urlopen

from pantograph.fuzzy_search import FuzzySearch
from pantograph.click_search import search, Calibration
import pantograph.store as store
import pantograph.metered as metered

from dataclasses import dataclass

logger = logging.getLogger("pantograph")

def create_app():
    logging.basicConfig(level=logging.INFO)

    app = Flask(__name__, static_url_path="", static_folder="static")
    auth = HTTPBasicAuth()
    fuzzy = FuzzySearch()

    users = {
        "webcamrunner":
        "pbkdf2:sha256:260000$5jRTOf7JzuA7uBj8$4bc7bed99d160de7c3c5ab88d43488c9467dd9459198f33e9f601b59e0dede02"
    }

    @auth.verify_password
    def verify_password(nickname, password):
        if nickname in users and \
                check_password_hash(users.get(nickname), password):
            return nickname

    @app.route("/")
    @auth.login_required
    def index():
        return send_file("static/index.html")

    @app.route("/app/<room_id>")
    @auth.login_required
    def main_app(room_id):
        nickname = request.args.get("nickname")
        room = store.get_room(room_id)
        if not room:
            return ("no room found", 404) # TODO render HTML
        if nickname:
            logger.info(f"user {nickname} loaded room {room_id} as host")
        # TODO check if there are already two people in the room,
        # and if so send the spectator page
        r = send_file("static/app.html")
        return r

    @app.route("/room", methods=["POST"])
    @auth.login_required
    def room():
        json = request.get_json()
        nickname = json.get("nickname")
        side = json.get("side")
        fmt = json.get("format")
        room = store.create_room(nickname, side, fmt)
        successful = metered.create_room(room["id"])
        if successful:
            logger.info(f"created room: {room}")
            return jsonify(room)
        else:
            return ("failed to create metered room", 500)

    @app.route("/recognize", methods=["POST"])
    @auth.login_required
    def recognize():
        json = request.get_json()
        data_uri = json.get("image")
        calibration = json.get("calibration")
        if calibration:
            calibration = Calibration(calibration["w"], calibration["h"])
        else:
            calibration = Calibration(100, 200)
        side = json.get("side")
        fmt = json.get("format")
        with urlopen(data_uri) as response:
            img_bytes = response.file.read()
        texts = search(img_bytes, calibration)
        if len(texts) > 0:
            card = fuzzy.search_multiple(texts, side, fmt)
            return jsonify([{"title": card.title, "code": card.code}])
        else:
            return jsonify([])

    return app

app = create_app()
socketio = SocketIO(app)

@socketio.on("offer")
def handle_offer(data):
    logger.info(f"offer: [{request.sid}] {repr(data)}")
    store.set_connection(request.sid, "offer", data)
    connection = store.get_connection(request.sid)
    room = connection["room_id"]
    other = store.get_other_connection(room, request.sid)
    socketio.emit("offer", data, to=other["sid"])

@socketio.on("answer")
def handle_answer(data):
    logger.info(f"answer: [{request.sid}] {repr(data)}")
    store.set_connection(request.sid, "answer", data)
    connection = store.get_connection(request.sid)
    room = connection["room_id"]
    other = store.get_other_connection(room, request.sid)
    socketio.emit("answer", data, to=other["sid"])

@socketio.on("icecandidate")
def handle_ice_candidate(data):
    logger.info(f"icecandidate: [{request.sid}] {repr(data)}")
    store.set_connection(request.sid, "icecandidate", data)
    connection = store.get_connection(request.sid)
    room = connection["room_id"]
    other = store.get_other_connection(room, request.sid)
    socketio.emit("icecandidate", data, to=other["sid"])

@socketio.on("join")
def handle_join(data):
    # TODO: look up room, if not found, send error message?
    # TODO: check nickname present
    room_id = data.get("id")
    nickname = data.get("nickname")
    side = data.get("side")
    join_room(room_id)
    room = store.join_room(request.sid, room_id, nickname, side)
    logger.info(f"join: [{request.sid}] {room_id} {nickname} {side}")
    socketio.emit("joined", room, to=room_id)

@socketio.on("connect")
def handle_connect(data):
    logger.info(f"connect: [{request.sid}]")
    store.set_connection(request.sid)

@socketio.on("disconnect")
def handle_disconnect():
    logger.info(f"disconnect: [{request.sid}]")
    store.delete_connection(request.sid)
