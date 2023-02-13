from flask import Flask, send_file, request, jsonify
from flask_socketio import SocketIO, join_room, leave_room
from flask_httpauth import HTTPBasicAuth
from werkzeug.security import generate_password_hash, check_password_hash
from flask_cors import CORS

import requests
import urllib
import logging
import threading
import time
from io import BytesIO
from urllib.request import urlopen
import base64

from pantograph.fuzzy_search import FuzzySearch
from pantograph.click_search import search

import os

logger = logging.getLogger("pantograph")

room='StoneshipChartRoom'

def data_uri_to_base64(uri):
    with urlopen(uri) as response:
        data = response.read()
    a = base64.b64encode(bstr).decode('ascii')
    return (bstr, a)

def create_app():
    logging.basicConfig(level=logging.DEBUG)

    app = Flask(__name__, static_url_path='', static_folder='static')
    CORS(app,resources={r"/*":{"origins":"*"}})
    auth = HTTPBasicAuth()
    fuzzy = FuzzySearch()

    users = {
        "corp": generate_password_hash("bluesun"),
        "runner": generate_password_hash("redteam")
    }

    @auth.verify_password
    def verify_password(username, password):
        if username in users and \
                check_password_hash(users.get(username), password):
            return username

    @app.route("/")
    @auth.login_required
    def index():
        r = send_file('static/index.html')
        r.set_cookie('username', auth.username())
        return r

    @app.route("/recognize", methods=["POST"])
    @auth.login_required
    def recognize():
        json = request.get_json()
        data_uri = json['image']
        with urlopen(data_uri) as response:
            img_bytes = response.file.read()
        texts = search(img_bytes)
        if len(texts) > 0:
            card = fuzzy.search_multiple(texts)
            return jsonify([{'title': card.title, 'code': card.code}])
        else:
            return jsonify([])

    return app

app = create_app()
# socketio = SocketIO(app)
socketio = SocketIO(app,cors_allowed_origins="*")

connections = {}

def ping():
    global connections
    while True:
        time.sleep(1)
        keys = connections.keys()
        if len(keys) < 1:
            continue
        for key in keys:
            connection = connections[key]
            if not connection or not connection['username']:
                continue
            username = connection['username']
            print("sent message to " + username)
            socketio.send("-> " + username, to=key)

t = threading.Thread(target=ping)
t.daemon = True
#t.start()

def get_other_connection(room, sid):
    global connections
    keys = connections.keys()
    if len(keys) < 1:
        return
    for key in keys:
        connection = connections.get(key)
        if connection and room == connection['room'] and sid != key:
            return connection
    return None

def set_connection(sid, k=None, v=None):
    global connections
    connection = get_connection(sid)
    if not connection:
        connections[sid] = {'sid': sid}
    if k and v:
        connections[sid][k] = v

def get_connection(sid):
    global connections
    return connections.get(sid)

def delete_connection(sid):
    global connections
    connections[sid] = None

@socketio.on('offer')
def handle_offer(data):
    print(f"Got offer: {request.sid} {repr(data)}")
    set_connection(request.sid, 'offer', data)
    connection = get_connection(request.sid)
    room = connection['room']
    other = get_other_connection(room, request.sid)
    socketio.emit('offer', data, to=other['sid'])

@socketio.on('answer')
def handle_answer(data):
    print(f"Got answer: {request.sid} {repr(data)}")
    set_connection(request.sid, 'answer', data)
    connection = get_connection(request.sid)
    room = connection['room']
    other = get_other_connection(room, request.sid)
    socketio.emit('answer', data, to=other['sid'])

@socketio.on('icecandidate')
def handle_ice_candidate(data):
    print(f"Got ice candidate: {request.sid} {repr(data)}")
    set_connection(request.sid, 'icecandidate', data)
    connection = get_connection(request.sid)
    room = connection['room']
    other = get_other_connection(room, request.sid)
    socketio.emit('icecandidate', data, to=other['sid'])

@socketio.on('join')
def handle_join(data):
    global room
    username = data["username"]
    join_room(room)
    print(f"User joined: {request.sid} {username}")
    set_connection(request.sid, 'room', room)
    set_connection(request.sid, 'username', username)
    socketio.emit('join', {'username': username}, to=room)

@socketio.on('connect')
def handle_connect(data):
    print(f"Connected: {request.sid}")
    set_connection(request.sid)

@socketio.on('disconnect')
def handle_disconnect():
    print(f"Disconnected: {request.sid}")
    delete_connection(request.sid)

def run():
    global socketio
    socketio.run(app)
