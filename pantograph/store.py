import uuid

# TODO these become DB collections?
rooms = {}
connections = {}

def set_connection(sid, k=None, v=None):
    connection = connections.get(sid)
    if not connection:
        connections[sid] = {"sid": sid}
    if k and v:
        connections[sid][k] = v

def get_connection(sid):
    return connections.get(sid)

def get_other_connection(room_id, sid):
    keys = connections.keys()
    for key in keys:
        connection = connections.get(key)
        if connection and room_id == connection["room_id"] and sid != key:
            return connection
    return None

def delete_connection(sid):
    connections[sid] = None

def create_room(nickname, side, fmt):
    room_id = str(uuid.uuid4())
    member = {
        "nickname": nickname,
        "side": side,
        "role": "host",
        "room_id": room_id
    }
    members = {nickname: member}
    rooms[room_id] = {"members": members, "format": fmt, "id": room_id}
    return rooms[room_id]

def get_room(room_id):
    return rooms.get(room_id)

def join_room(sid, room_id, nickname, side):
    room = rooms.get(room_id)
    if not room:
        return None
    members = room["members"]
    member = members.get(nickname)
    if not member:
        member = {
            "nickname": nickname,
            "side": side,
            "sid": sid,
            "room_id": room_id,
            "role": "guest"
        }
    else:
        member["sid"] = sid
    members[nickname] = member
    connections[sid] = member
    return room

def get_from_room(room_id, key):
    room = rooms.get(room_id)
    if room:
        return room.get(key)
    else:
        return None

def set_on_room(room_id, key, val):
    room = rooms.get(room_id)
    if room:
        room[key] = val
        return (key, val)
    else:
        return None
