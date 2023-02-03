from google.cloud import vision
import io
import logging
import time

client = vision.ImageAnnotatorClient()

logger = logging.getLogger("pantograph")


def _text_detection(path):
    with io.open(path, "rb") as image_file:
        content = image_file.read()
    image = vision.Image(content=content)
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

def recognize(path):
    response = _text_detection(path)
    annotation = response.full_text_annotation
    return annotation.text

def _vertices_to_box(vertices, x0, y0):
    upper_left = vertices[0]
    lower_right = vertices[2]
    x = upper_left.x
    y = upper_left.y
    w = lower_right.x - x
    h = lower_right.y - y
    return (x+x0,y+y0,w,h)

def _vertices_to_box(vertices, x0, y0):
    upper_left = vertices[0]
    lower_right = vertices[2]
    x = upper_left.x
    y = upper_left.y
    w = lower_right.x - x
    h = lower_right.y - y
    return (x+x0, y+y0, w, h)

def _collect_blocks(response, x0, y0):
    annotation = response.full_text_annotation

    blocks = []
    for page in annotation.pages:
        for block in page.blocks:
            text = []
            for paragraph in block.paragraphs:
                for word in paragraph.words:
                    for symbol in word.symbols:
                        text.append(symbol.text)
            vertices = block.bounding_box.vertices
            box = _vertices_to_box(vertices, x0, y0)
            blocks.append(("".join(text), box))
    return blocks

def search(path, x0, y0):
    response = _text_detection(path)
    return _collect_blocks(response, x0, y0)
