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

from pantograph.loop import loop
from pantograph.detect import Detector
import pantograph.web as web

def main():
    parser = argparse.ArgumentParser(description='TODO')
    parser.add_argument('--web', action='store_true', help='Start the web server.')
    parser.add_argument(
        "--host", default="0.0.0.0", help="Host for HTTP server (default: 0.0.0.0)"
    )
    parser.add_argument(
        "--port", type=int, default=8080, help="Port for HTTP server (default: 8080)"
    )
    args = parser.parse_args()

    backsub = cv.createBackgroundSubtractorMOG2()
    detector = Detector(backsub)

    logging.basicConfig(filename='/var/log/pantograph/pantograph.log', encoding='utf-8', level=logging.DEBUG)
#    logging.basicConfig(level=logging.INFO)
    if args.web:
        web.run(args, detector)
    else:
        capture = cv.VideoCapture(1)
        if not capture.isOpened():
            print("Cannot open camera")
            exit()
        loop(detector, capture)
