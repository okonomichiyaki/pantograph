from google.cloud import vision
import io

client = vision.ImageAnnotatorClient()

def recognize(path):
    with io.open(path, "rb") as image_file:
        content = image_file.read()
    image = vision.Image(content=content)
    try:
        response = client.text_detection(image=image)
        if response.error.message:
            raise RecognizerException(
                "Google Cloud Vision response contained error message: "
                + response.error.message
            )
        annotation = response.full_text_annotation
        return annotation.text
    except Exception as e:
        raise RecognizerException(
            "Google Cloud Vision client threw exception: " + e.message
        ) from e
