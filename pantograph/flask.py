from flask import Flask, send_file, request, jsonify
from flask_httpauth import HTTPBasicAuth
from werkzeug.security import generate_password_hash, check_password_hash

from PIL import Image
from io import BytesIO
import urllib
import logging

import pantograph.google_vision as vision
from pantograph.card_search import init_card_search

logging.basicConfig(level=logging.DEBUG)

def create_app():
    app = Flask(__name__, static_url_path='', static_folder='static')
    auth = HTTPBasicAuth()
    card_search = init_card_search(imagesdir=None)

    users = {
        "corp": generate_password_hash("blue sun"),
        "runner": generate_password_hash("red team")
    }

    @auth.verify_password
    def verify_password(username, password):
        if username in users and \
                check_password_hash(users.get(username), password):
            return username

    @app.route("/")
    @auth.login_required
    def index():
        return send_file('static/index.html')

    @app.route("/recognize", methods=["POST"])
    @auth.login_required
    def recognize():
        json = request.get_json()
        data = json['image']
        response = urllib.request.urlopen(data)
        text = vision.recognize_bytes(response.file.read())
        lines = text.split("\n")
        lines = [ line for line in lines if len(line) > 2 ]
        if len(lines) > 0:
            card = card_search.text_search(lines[0])
            return jsonify([{'title': card.title, 'code': card.code}])
        else:
            return jsonify([])

    return app
