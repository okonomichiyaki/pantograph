from __future__ import print_function
import cv2 as cv
import numpy as np
import argparse
import logging

from io import StringIO
from csv import DictReader

import io
import os
import sys
from itertools import groupby

from pantograph.card_search import init_card_search
from pantograph.loop import loop
from pantograph.detect import Detector
import pantograph.web as web


def main():
    parser = argparse.ArgumentParser(description='TODO')
    parser.add_argument('--log-level', type=str, default='info')
    parser.add_argument('--web', action='store_true', help='Start the web server.')
    parser.add_argument(
        "--host", default="0.0.0.0", help="Host for HTTP server (default: 0.0.0.0)"
    )
    parser.add_argument(
        "--port", type=int, default=8080, help="Port for HTTP server (default: 8080)"
    )
    parser.add_argument(
        "--camera", type=int, default=0, help="Camera device number"
    )
    parser.add_argument(
        "--fuzzy", type=str, help="Fuzzy text search"
    )
    args = parser.parse_args()

    #logging.basicConfig(
    #filename='/var/log/pantograph/pantograph.log', encoding='utf-8', level=logging.DEBUG)
    if args.log_level.lower() == 'debug':
        logging.basicConfig(level=logging.DEBUG)
    else:
        logging.basicConfig(level=logging.INFO)

    # TODO: config for images dir
    card_search = init_card_search(imagesdir='/Users/aki/Downloads/images')
    if (args.fuzzy):
        card = card_search.text_search(args.fuzzy)
        print(f"{card.title} [{card.code}]")
        exit(0)

    backsub = cv.createBackgroundSubtractorMOG2()
    detector = Detector(backsub, card_search)

    if args.web:
        web.run(args, detector)
    else:
        capture = cv.VideoCapture(args.camera)
        if not capture.isOpened():
            print("Cannot open camera")
            exit()
        loop(detector, capture)
