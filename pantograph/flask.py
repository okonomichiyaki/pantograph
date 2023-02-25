from flask import Flask, send_file, request, jsonify
from flask_socketio import SocketIO, join_room, leave_room
from flask_httpauth import HTTPBasicAuth
from werkzeug.security import generate_password_hash, check_password_hash

import os
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
        "webcamrunner": "pbkdf2:sha256:260000$621v9iA5hAvobZE1$13531db238e4f0b33b24a34bae631ea56c3c868caaac1fc93e7ae4e52b1d5d70"
    }

    if os.environ.get("TESTING"):

        @auth.verify_password
        def verify_password(nickname, password):
            return True

    else:

        @auth.verify_password
        def verify_password(nickname, password):
            if nickname in users and check_password_hash(users.get(nickname), password):
                return nickname

    @app.route("/")
    @auth.login_required
    def index():
        return send_file("static/index.html")

    @app.route("/about")
    @auth.login_required
    def about():
        return send_file("static/about.html")

    @app.route("/app/<room_id>")
    @auth.login_required
    def main_app(room_id):
        if room_id == 'demo':
            return send_file("static/app.html")
        nickname = request.args.get("nickname")
        room = store.get_room(room_id)
        if not room:
            return ("no room found", 404)  # TODO render HTML
        if nickname:
            logger.info(f"user {nickname} loaded room {room_id} as host")
        return send_file("static/app.html")

    @app.route("/room/<room_id>", methods=["GET"])
    @auth.login_required
    def get_room(room_id):
        room = store.get_room(room_id)
        if not room:
            return ("", 404)
        else:
            return jsonify(room)

    @app.route("/room", methods=["POST"])
    @auth.login_required
    def create_room():
        json = request.get_json()
        nickname = json.get("nickname")
        side = json.get("side")
        fmt = json.get("format")
        room = store.create_room(nickname, side, fmt)
        if json.get("demo"):
            logger.info(f"created room (demo): {room}")
            return jsonify(room)
        successful = metered.create_room(room["id"])
        if successful:
            logger.info(f"created room (metered): {room}")
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
        search_results = search(img_bytes, calibration)
        texts = search_results["filtered"]
        if len(texts) > 0:
            fuzzy_results = fuzzy.search_multiple(texts, side, fmt)
            search_results["cards"] = [
                {"title": card.title, "code": card.code, "dist": d}
                for (card, d) in fuzzy_results
            ]
            return jsonify(search_results)
        else:
            return jsonify({"cards": []})

    return app


app = create_app()
socketio = SocketIO(app)


@socketio.on("join")
def handle_join(data):
    room_id = data.get("id")
    nickname = data.get("nickname")
    side = data.get("side")
    room = store.join_room(request.sid, room_id, nickname, side)
    if room:
        join_room(room_id)
        payload = {
            "room": room,
            "joiner": room["members"][nickname]
        }
        socketio.emit("joined", payload, to=room_id)
        logger.info(f"join: [{request.sid}] {room_id} {nickname} {side}")
    else:
        logger.info(f"join: [{request.sid}] no room found: {room_id}")


@socketio.on("connect")
def handle_connect(data):
    logger.info(f"connect: [{request.sid}]")


@socketio.on("disconnect")
def handle_disconnect():
    member = store.delete_connection(request.sid)
    if member:
        room_id = member["room_id"]
        room = store.get_room(room_id)
        payload = {
            "room": room,
            "exiter": member
        }
        socketio.emit("exited", payload, to=room_id)
        nickname = member["nickname"]
        logger.info(f"disconnect: [{request.sid}] {nickname}")
    else:
        logger.info(f"disconnect: [{request.sid}] ?")
