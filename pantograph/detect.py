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
from collections import deque

import pantograph.google_vision as vision
import pantograph.card_search as card_search


BLUE = (255,0,0)
GREEN = (0,255,0)
RED = (0,0,255)
YELLOW = (0,255,255)
FUSCHIA = (255,0,255)


STABILIZE_MIN_FRAMES = 5
STABILIZE_RATIO = 0.1
LEARNING_RATE = 0.001
MIN_CONTOUR_AREA = 10000

logger = logging.getLogger("pantograph")

def approx(c):
    epsilon = 0.1*cv.arcLength(c,True)
    return cv.approxPolyDP(c,epsilon,True)

def compute_distance(aa, bb):
    distances = []
    for a in aa:
        distance = np.inf
        closest = None
        for b in bb:
            d = np.linalg.norm(a-b)
            if d < distance:
                distance = d
                closest = b
        distances.append(distance)
    return sum(distances)

def no_overlap(cards, points):
    ax1 = points[0][0]
    ay1 = points[0][1]
    ax2 = points[3][0]
    ay2 = points[3][1]
    for card in cards:
        box = card["box"]
        bx1 = box[0][0]
        by1 = box[0][1]
        bx2 = box[3][0]
        by2 = box[3][1]
        if ax1 < bx2 and ax2 > bx1 and ay1 < by2 and ay2 > by1:
            return False
    return True

def check_for_candidate(cards, c):
    x,y,w,h = cv.boundingRect(c)
    bounding_points = [
        np.array((x, y)),
        np.array((x+w, y)),
        np.array((x, y+h)),
        np.array((x+w, y+h))
    ]
    rect = cv.minAreaRect(c)
    min_area_points = cv.boxPoints(rect)
    min_area_points = np.intp(min_area_points)
    total = compute_distance(bounding_points, min_area_points)
#    print(f"candidate: {total}")
    if total < 50 and no_overlap(cards, bounding_points):
        return bounding_points
    else:
        return None

class Detector:

    def __init__(self, backsub):
        self._backsub = backsub
        self._cards = []
        self._reference = None
        self._saved_candidate = None
        self._saved_c = None
        self._saved_count = 0

        self._state = "stabilizing"
        self._ratios = deque(maxlen=STABILIZE_MIN_FRAMES)

    def _has_stabilized(self, mask):
        """
        Returns true if the background has stabilized. Accommodate for messy initial frames
        Stabilized means the ratio of foreground to background is less than STABILIZE_RATIO,
        and we've seen at least STABILIZE_MIN_FRAMES individual frames.
        """
        count = np.count_nonzero(mask == 255)
        size = mask.size
        this_ratio = count / size
        self._ratios.append(this_ratio)
        mean_ratio = np.mean(self._ratios)
        logger.debug(f"stabilizing: {this_ratio} {mean_ratio}")
        return mean_ratio < STABILIZE_RATIO and len(self._ratios) >= STABILIZE_MIN_FRAMES

    def _tighten(self, mask):
        # Morphological opening and closing to improve mask
        kernel = np.ones((5,5),np.uint8)
        mask = cv.morphologyEx(mask, cv.MORPH_OPEN, kernel)
        mask = cv.morphologyEx(mask, cv.MORPH_CLOSE, kernel)
        mask[mask < 255] = 0
        return mask

    def _draw_candidate(self, output, c, color):
        x,y,w,h = cv.boundingRect(c)
        cv.rectangle(output,(x,y),(x+w,y+h),color,2)

    def _draw_non_candidate(self, output, c):
        x,y,w,h = cv.boundingRect(c)
        rect = cv.minAreaRect(c)
        box = cv.boxPoints(rect)
        box = np.intp(box)
        if no_overlap(self._cards, box):
            cv.rectangle(output,(x,y),(x+w,y+h),RED,2)
            cv.drawContours(output,[box],0,BLUE,2)

    def _is_locked(self, candidate):
        distance = compute_distance(candidate, self._saved_candidate)
        logger.debug(f"distance: {distance} saved_count: {self._saved_count}")
        if distance < 10:
            self._saved_count = self._saved_count + 1
            return self._saved_count > 2
        else:
            self._saved_candidate = None
            self._saved_c = None
            self._saved_count = None
            return False

    def _update_cards_and_draw(self, output):
#        fresh_cards = [card for card in self._cards if card["fresh"]]
        for card in self._cards:
#            card["fresh"] = False
            box = card["box"]
            x1 = box[0][0]
            y1 = box[0][1]
            x2 = box[3][0]
            y2 = box[3][1]
            cv.rectangle(output,(x1,y1),(x2,y2),(0,255,0),2)
#        self._cards = fresh_cards

    def _save_card(self, frame):
        card = {"box": self._saved_candidate, "fresh": True}
        self._cards.append(card)
        x = self._saved_candidate[0][0]
        y = self._saved_candidate[0][1]
        w = self._saved_candidate[3][0] - x
        h = self._saved_candidate[3][1] - y
        if self._state == "calibrating":
            self._reference = (x,y,w,h)
            self._state = "detecting"
        cropped = frame[y:int(y+(h/2)), x:x+w]
        cv.imwrite("card.jpg", cropped)
        text = vision.recognize("card.jpg")
        title = card_search.fuzzy_search(text)
        print(f"found a card? {title}")

    def detect(self, frame):
        output = frame.copy()

        mask = self._backsub.apply(frame, learningRate=LEARNING_RATE)
        mask = self._tighten(mask)

        if self._state == "stabilizing":
            stabilized = self._has_stabilized(mask)
            if stabilized:
                self._state = "calibrating"
                logger.info("background stabilized")
        elif self._state == "calibrating" or self._state == "detecting":
            contours, hierarchy = cv.findContours(mask,cv.RETR_EXTERNAL,cv.CHAIN_APPROX_SIMPLE)
            contours = [ approx(c) for c in contours if cv.contourArea(c) > MIN_CONTOUR_AREA ] # min area could be based on calibration
            # TODO: sort contours by x/y ?

            for c in contours:
                candidate = check_for_candidate(self._cards, c)
                if candidate:
                    if not self._saved_candidate:
                        self._saved_candidate = candidate
                        self._saved_c = c
                        self._saved_count = 0
                    elif self._is_locked(candidate):
                        self._save_card(frame)
                        self._saved_candidate = None
                        self._saved_c = None
                        self._saved_count = 0
                    else:
                        self._draw_candidate(output, c, YELLOW)
                else:
                    self._draw_non_candidate(output, c)

            self._update_cards_and_draw(output)

        return (output, mask, None)
