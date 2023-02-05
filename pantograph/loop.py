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

import collections
import queue
import threading

import pantograph.google_vision as vision
import pantograph.card_search as card_search
from pantograph.drawing import draw


logger = logging.getLogger("pantograph")


def loop(detector, capture):
    show_mask = True
    last_frame = None
    old_state = None

    def mouse_callback(event,x,y,flags,param):
        if event == cv.EVENT_LBUTTONDOWN and (last_frame is not None):
            logger.debug(f"mouse_callback: x={x} y={y}")
            title = detector.search_click(last_frame, x, y)
            logger.debug(f"search_click: {title}")
            #detector.lookup_click(x, y)

    cv.namedWindow('pantograph')
    cv.setMouseCallback('pantograph', mouse_callback)

    inq = queue.Queue()
    outq = collections.deque(maxlen=1)

    def worker():
        while True:
            frame = inq.get()
            app_state = detector.detect(frame)
            outq.append(app_state)

    threading.Thread(target=worker, daemon=True).start()

    while True:
        ret, frame = capture.read()

        if frame is None:
            break

        inq.put(frame)
        output = frame.copy()
        try:
            new_state = outq.pop()
            old_state = new_state
            if show_mask:
                output = new_state.mask
            else:
                draw(new_state, output)
        except IndexError:
            logger.debug("timed out")
            if old_state:
                draw(old_state, output)

        cv.imshow('pantograph', output)
        last_frame = frame

        keyboard = cv.waitKey(30)
        # if keyboard != -1:
        #     print(keyboard)
        # if keyboard == 32 and len(last_contours) > 0: # space
        #     paused = not paused
        if keyboard == 27: # escape
            break
        if keyboard == 109: # m key
            show_mask = not show_mask
