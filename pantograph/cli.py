from __future__ import print_function
import cv2 as cv
import numpy as np
import argparse

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
    parser.add_argument('--web', type=bool)
    parser.add_argument('--input', type=str, help='Path to a video or a sequence of image.')
    parser.add_argument('--algo', type=str, help='Background subtraction method (KNN, MOG2).', default='MOG2')
    args = parser.parse_args()

    if args.web:
        web.run()
    else:
        if args.algo == 'MOG2':
            backsub = cv.createBackgroundSubtractorMOG2()
        else:
            backsub = cv.createBackgroundSubtractorKNN()

        detector = Detector(backsub)
        capture = None
        if args.input:
            capture = cv.VideoCapture(cv.samples.findFileOrKeep(args.input))
            if not capture.isOpened():
                print('Unable to open: ' + args.input)
                exit(0)
        else:
            capture = cv.VideoCapture(0)
            if not capture.isOpened():
                print("Cannot open camera")
                exit()
        loop(detector, capture)
