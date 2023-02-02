from google.cloud import vision
import io
import logging
import time

client = vision.ImageAnnotatorClient()

logger = logging.getLogger("pantograph")


def recognize(path):
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
        annotation = response.full_text_annotation
        return annotation.text
    except Exception as e:
        logger.error(f"Google Cloud Vision client threw exception {e}")
