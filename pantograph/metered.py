import os
import logging
import requests

logger = logging.getLogger("pantograph")

def create_room(room_id):
    key = os.environ.get("METERED_API_KEY")
    if not key:
        logger.error("No metered api key found")
        return False
    url = f"https://pantograph.metered.live/api/v1/room?secretKey={key}"
    request = {"roomName": room_id}
    r = requests.post(url, json=request)
    if r.status_code:
        return True
    else:
        logger.error(f"Failed to create metered room: {r.json()}")
