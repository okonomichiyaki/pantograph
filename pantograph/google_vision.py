import io
import logging
import time
import math
import requests
import numpy as np
import os
import base64

logger = logging.getLogger("pantograph")


class Block:
    def __init__(self, words, vertices):
        self.words = words
        self.text = " ".join(self.words)
        upper_left = vertices[0]
        lower_right = vertices[2]
        self.x = upper_left.get("x", 0)
        self.y = upper_left.get("y", 0)
        self.w = lower_right.get("x", 0) - self.x
        self.h = lower_right.get("y", 0) - self.y
        self.points = [[v.get("x", 0), v.get("y", 0)] for v in vertices]

    @property
    def rotation(self):
        dist = np.inf
        closest = -1
        for i in range(4):
            v = self.points[i]  # self.vertices[i]
            d = math.hypot(v[0], v[1])
            if d < dist:
                dist = d
                closest = i
        match closest:
            case 0:
                return 0
            case 3:
                return 90
            case 2:
                return 180
            case 1:
                return 270
            case _:
                return None

    @property
    def upper_left(self):
        return (self.x, self.y)

    @property
    def lower_right(self):
        return (self.x + self.w, self.y + self.h)


def recognize_base64(b64):
    start = time.perf_counter()

    try:
        key = os.environ.get("VISION_API_KEY")
        if key is None:
            logger.error(f"No vision api key found")
            return []
        url = f"https://vision.googleapis.com/v1/images:annotate?key={key}"
        annotate_image_request = {
            "requests": [
                {"image": {"content": b64}, "features": [{"type": "TEXT_DETECTION"}]}
            ]
        }
        r = requests.post(url, json=annotate_image_request)
        if r.status_code == 200:
            json = r.json()
            return _collect_blocks_json(json)
    finally:
        elapsed = time.perf_counter() - start
        logger.debug("received response from google vision in %.2f", elapsed)


def _collect_blocks_json(response):
    try:
        responses = response["responses"]
        if len(responses) < 1:
            logger.debug(f"Vision API returned empty list of responses: {response}")
            return []
        r = responses[0]
        annotation = r["fullTextAnnotation"]
        blocks = []
        for page in annotation["pages"]:
            for block in page["blocks"]:
                for paragraph in block["paragraphs"]:
                    words = []
                    for word in paragraph["words"]:
                        chars = []
                        for symbol in word["symbols"]:
                            chars.append(symbol["text"])
                        words.append("".join(chars))
                    vertices = paragraph["boundingBox"]["vertices"]
                    block = Block(words, vertices)
                    blocks.append(block)
        return blocks
    except Exception as e:
        logger.error(f"caught exception parsing response: {response} {e}")
        return []


def recognize_bytes(data):
    b64 = base64.b64encode(data).decode("ascii")
    return recognize_base64(b64)


def recognize_file(path):
    with open(path, "rb") as image_file:
        data = image_file.read()
        return recognized_bytes(data)
