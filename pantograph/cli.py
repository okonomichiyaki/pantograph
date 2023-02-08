import argparse
import logging

import io
import os
import sys
from itertools import groupby

from pantograph.google_vision import recognize
from pantograph.card_search import init_card_search

def main():
    parser = argparse.ArgumentParser(description='TODO')
    parser.add_argument('--log-level', type=str, default='info')
    parser.add_argument(
        "--fuzzy", type=str, help="Fuzzy text search"
    )
    parser.add_argument(
        "--google-vision", type=str, help="Google Vision API searc"
    )

    args = parser.parse_args()

    if args.log_level.lower() == 'debug':
        logging.basicConfig(level=logging.DEBUG)
    else:
        logging.basicConfig(level=logging.INFO)

    card_search = init_card_search()

    if (args.google_vision):
        filename = args.google_vision
        result = recognize(filename)
        lines = result.split("\n")
        card = card_search.text_search(lines[0])
        print(f"{card.title} [{card.code}]")
        exit(0)

    if (args.fuzzy):
        card = card_search.text_search(args.fuzzy)
        print(f"{card.title} [{card.code}]")
        exit(0)
