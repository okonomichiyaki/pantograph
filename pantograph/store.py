import uuid
import os
import logging
from collections import defaultdict

from pymongo import MongoClient
from pymongo.server_api import ServerApi
import bson.json_util as json_util
import json

logger = logging.getLogger("pantograph")


def get_database():
    connection = os.environ.get("MONGO_CONNECTION_STRING")
    client = MongoClient(connection, server_api=ServerApi("1"))
    return client["pantograph"]


db = get_database()


def delete_connection(sid):
    coll = db["connections"]
    data = coll.find_one({"sid": sid})
    if not data:
        return None
    data = json.loads(json_util.dumps(data))
    member = data["member"]
    if member:
        nickname = member["nickname"]
        room_id = member["room_id"]
        side = member["side"]
        update = {"$unset": {f"members.{nickname}": ""}}
        if side != "spectator":
            update["$set"] = {side: None}
        db["rooms"].update_one({"room_id": room_id}, update)
    coll.delete_one({"sid": sid})
    return member


def create_room(nickname, side, fmt):
    room_id = str(uuid.uuid4())
    room = {
        "corp": None,
        "runner": None,
        "members": {},
        "format": fmt,
        "room_id": room_id,
    }
    coll = db["rooms"]
    coll.insert_one(room)
    return json.loads(json_util.dumps(room))


def get_room(room_id):
    coll = db["rooms"]
    data = coll.find_one({"room_id": room_id})
    return json.loads(json_util.dumps(data))


def join_room(sid, room_id, nickname, side):
    room = get_room(room_id)
    if not room:
        return None
    member = {
        "nickname": nickname,
        "side": side,
        "sid": sid,
        "room_id": room_id,
    }
    coll = db["rooms"]
    if side != "spectator":
        update = {f"members.{nickname}": member, side: nickname}
    else:
        update = {f"members.{nickname}": member}
    coll.update_one({"room_id": room_id}, {"$set": update})
    coll = db["connections"]
    coll.insert_one({"sid": sid, "member": member})
    room["members"][nickname] = member
    return room


def cleanup():
    db["rooms"].delete_many({})
    db["connections"].delete_many({})
