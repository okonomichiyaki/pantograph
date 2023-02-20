import argparse
import logging
import io

from pantograph.fuzzy_search import FuzzySearch
from pantograph.click_search import search


def main():
    parser = argparse.ArgumentParser(description="TODO")
    parser.add_argument("--log-level", type=str, default="info")
    parser.add_argument(
        "--fmt",
        type=str,
        help="Specify which format (startup or standard) to search through",
        default="startup",
    )
    parser.add_argument(
        "--side",
        type=str,
        help="Specify which side (runner or corp) to search through",
        default="both",
    )
    parser.add_argument(
        "--fuzzy", type=str, help="Search for cards using fuzzy text over titles"
    )
    parser.add_argument(
        "--image", type=str, help="Search for cards using Google Vision OCR"
    )
    args = parser.parse_args()

    if args.log_level.lower() == "debug":
        logging.basicConfig(level=logging.DEBUG)
    else:
        logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger("pantograph")

    fuzzy = FuzzySearch()

    if args.image:
        filename = args.image
        with io.open(filename, "rb") as image_file:
            image_bytes = image_file.read()
        texts = search(image_bytes, visual_debug=True)
        results = fuzzy.search_multiple(texts, args.side, args.fmt)
        if len(results) > 0:
            for card, dist in results:
                print(f"{card.title} ({card.code}) [{dist}]")
        else:
            print("Failed to identify any cards")
        exit(0)

    if args.fuzzy:
        results = fuzzy.search(args.fuzzy, args.side, args.fmt)
        if len(results) > 0:
            for card, dist in results:
                print(f"{card.title} ({card.code}) [{dist}]")
        else:
            print("Failed to identify any cards")
        exit(0)
