import argparse
import logging
import io

import pantograph.fuzzy_search as fuzzy_search
from pantograph.click_search import search

def main():
    parser = argparse.ArgumentParser(description='TODO')
    parser.add_argument('--log-level', type=str, default='info')
    parser.add_argument(
        "--fuzzy", type=str, help="Search for cards using fuzzy text over titles"
    )
    parser.add_argument(
        "--image", type=str, help="Search for cards using Google Vision OCR"
    )
    args = parser.parse_args()

    if args.log_level.lower() == 'debug':
        logging.basicConfig(level=logging.DEBUG)
    else:
        logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger("pantograph")

    fuzzy = fuzzy_search.init()

    if (args.image):
        filename = args.image
        with io.open(filename, "rb") as image_file:
            image_bytes = image_file.read()
        texts = search(image_bytes)
        card = fuzzy.text_search_multiple(texts)
        if card:
            print(f"{card.title} [{card.code}]")
        else:
            print("Failed to identify card")
        exit(0)

    if (args.fuzzy):
        card = fuzzy.text_search(args.fuzzy)
        print(f"{card.title} [{card.code}]")
        exit(0)
