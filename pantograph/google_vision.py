from google.cloud import vision
import io
import logging
import time
import math
import numpy as np

client = vision.ImageAnnotatorClient()

logger = logging.getLogger("pantograph")

class Block:
    def __init__(self, words, vertices):
        self.words = words
        self.text = " ".join(self.words)
        upper_left = vertices[0]
        lower_right = vertices[2]
        self.x = upper_left.x
        self.y = upper_left.y
        self.w = lower_right.x - self.x
        self.h = lower_right.y - self.y
        self.vertices = vertices
        self.points = [ [v.x, v.y] for v in vertices ]

    @property
    def rotation(self):
        dist = np.inf
        closest = -1
        for i in range(4):
            v = self.vertices[i]
            d = math.hypot(v.x, v.y)
            if d < dist:
                dist = d
                closest = i
        match closest:
            case 0: return 0
            case 3: return 90
            case 2: return 180
            case 1: return 270
            case _: return None

    @property
    def upper_left(self):
        return (self.x, self.y)

    @property
    def lower_right(self):
        return (self.x + self.w, self.y + self.h)

def _text_detection(image):
    try:
        start = time.perf_counter()
        response = client.text_detection(image=image)
        elapsed = time.perf_counter() - start
        logger.debug("received response from google vision in %.2f", elapsed)
        if response.error.message:
            logger.error(f"Google Cloud Vision client returned error {response.error.message}")
            return None
        return response
    except Exception as e:
        logger.error(f"Google Cloud Vision client threw exception {e}")
        return None

def _collect_blocks(response):
    annotation = response.full_text_annotation
    blocks = []
    for page in annotation.pages:
        for block in page.blocks:
            for paragraph in block.paragraphs:
                words = []
                for word in paragraph.words:
                    chars = []
                    for symbol in word.symbols:
                        chars.append(symbol.text)
                    words.append("".join(chars))
                vertices = paragraph.bounding_box.vertices
                block = Block(words, vertices)
                blocks.append(block)
    return blocks

def recognize_bytes(content):
    image = vision.Image(content=content)
    response = _text_detection(image)
    annotation = response.full_text_annotation
    return _collect_blocks(response)

def recognize_file(path):
    with io.open(path, "rb") as image_file:
        content = image_file.read()
    return recognize_bytes(content)
