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

import pantograph.google_vision as vision
import pantograph.card_search as card_search

def loop(detector, capture):
    show_mask = False

    while True:
        ret, frame = capture.read()

        if frame is None:
            break

        (output, mask) = detector.detect(frame)
        if show_mask:
            cv.imshow('', mask)
        else:
            cv.imshow('', output)

        keyboard = cv.waitKey(30)
        # if keyboard != -1:
        #     print(keyboard)
        # if keyboard == 32 and len(last_contours) > 0: # space
        #     paused = not paused
        if keyboard == 27: # escape
            break
        if keyboard == 109: # m key
            show_mask = not show_mask
