import uuid
import logging
from collections import defaultdict

logger = logging.getLogger("pantograph")

# TODO these eventually become DB collections
rooms = defaultdict(lambda: None)
connections = defaultdict(lambda: None)

def delete_connection(sid):
    member = connections[sid]
    if member:
        nickname = member["nickname"]
        room_id = member["room_id"]
        room = rooms[room_id]
        if room:
            members = room["members"]
            del members[nickname]
            room[member["side"]] = None
    del connections[sid]
    return member

def create_room(nickname, side, fmt):
    room_id = str(uuid.uuid4())
    rooms[room_id] = {
        "corp": None,
        "runner": None,
        "members": {},
        "format": fmt,
        "id": room_id
    }
    return rooms[room_id]

def get_room(room_id):
    return rooms.get(room_id)

def join_room(sid, room_id, nickname, side):
    room = rooms[room_id]
    if not room:
        return None
    members = room["members"]
    member = {
        "nickname": nickname,
        "side": side,
        "sid": sid,
        "room_id": room_id,
    }
    members[nickname] = member
    room[side] = nickname
    connections[sid] = member
    return room
