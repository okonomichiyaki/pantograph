import os
import logging
import requests

logger = logging.getLogger("pantograph")

URL = "https://pantograph.metered.live/api/v1"

class MeteredApiException(Exception):
    pass

def get_url(path):
    key = os.environ.get("METERED_API_KEY")
    if not key:
        raise MeteredApiException("No metered api key found")
    url = URL + path + f"?secretKey={key}"
    return url

def create_room(room_id):
    url = get_url("/room")
    r = requests.post(url, json={
        "roomName": room_id,
        "ejectAfterElapsedTimeInSec": 60*60*3,
        "endMeetingAfterNoActivityInSec": 5*60
    })
    if r.status_code == 200:
        return True
    else:
        logger.error(f"Failed to create Metered room: {r.json()}")
        return False

def delete_room(room_id):
    url = get_url(f"/room/{room_id}")
    r = requests.delete(url)
    if r.status_code == 200:
        return True
    else:
        logger.error(f"Failed to delete Metered room: {r.json()}")
        return False

def get_all_rooms():
    url = get_url("/rooms")
    r = requests.get(url)
    if r.status_code == 200:
        return r.json()
    else:
        logger.error(f"Failed to get all Metered rooms: {r.json()}")

if __name__ == '__main__':
    rooms = get_all_rooms()
    for room in rooms:
        room_name = room['roomName']
        if delete_room(room_name):
            print(f"deleted {room_name}")
        else:
            print(f"failed to delete {room_name}")
