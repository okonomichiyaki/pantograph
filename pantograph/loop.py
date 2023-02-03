from __future__ import print_function
import cv2 as cv
import numpy as np
import argparse

from io import StringIO
from csv import DictReader

import logging
import io
import os
import sys
from itertools import groupby

import pantograph.google_vision as vision
import pantograph.card_search as card_search


logger = logging.getLogger("pantograph")



def loop(detector, capture):
    show_mask = True
    last_frame = None

    def mouse_callback(event,x,y,flags,param):
        if event == cv.EVENT_LBUTTONDOWN and (last_frame is not None):
            logger.debug(f"mouse_callback: x={x} y={y}")
            detector.search_click(last_frame, x, y)

    cv.namedWindow('pantograph')
    cv.setMouseCallback('pantograph', mouse_callback)

    while True:
        ret, frame = capture.read()

        if frame is None:
            break

        last_frame = frame
        (state, output, mask, card) = detector.detect(frame)
        if show_mask:
            cv.imshow('pantograph', mask)
        else:
            cv.imshow('pantograph', output)

        keyboard = cv.waitKey(30)
        # if keyboard != -1:
        #     print(keyboard)
        # if keyboard == 32 and len(last_contours) > 0: # space
        #     paused = not paused
        if keyboard == 27: # escape
            break
        if keyboard == 109: # m key
            show_mask = not show_mask
