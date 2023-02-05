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
from dataclasses import dataclass

import pantograph.google_vision as vision
import pantograph.card_search as card_search


STABILIZE_MIN_FRAMES = 5
STABILIZE_RATIO = 0.1
LEARNING_RATE = 0.001
MIN_CONTOUR_AREA = 10000
AREA_MARGIN = 5000

FEATURE_SAVE_IMAGES = False

logger = logging.getLogger("pantograph")


class AppState:
    def __init__(self, mask, candidate_contour, non_candidates, locked_cards, stale_cards, state):
        self.mask = mask
        self.candidate_contour = candidate_contour
        self.non_candidates = non_candidates
        self.locked_cards = locked_cards
        self.stale_cards = stale_cards
        self.state = state


class Card:
    def __init__(self, title, box_points):
        self.title = title
        self.box_points = box_points
        self.dirty = False

card_idx = 0
def get_card_filename():
    global card_idx
    if FEATURE_SAVE_IMAGES:
        filename = f"card{card_idx}.jpg"
        card_idx = card_idx + 1
        return filename
    else:
        return "card.jpg"

def approx(c):
    epsilon = 0.1*cv.arcLength(c,True)
    return cv.approxPolyDP(c,epsilon,True)

def box_points_dims(box_points):
    w = box_points[3][0] - box_points[0][0]
    h = box_points[3][1] - box_points[0][1]
    return (w,h)

def to_box_points(x,y,w,h):
    return [
        np.array((x, y)),
        np.array((x+w, y)),
        np.array((x, y+h)),
        np.array((x+w, y+h))
    ]

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
        box = card.box_points
        bx1 = box[0][0]
        by1 = box[0][1]
        bx2 = box[3][0]
        by2 = box[3][1]
        if ax1 < bx2 and ax2 > bx1 and ay1 < by2 and ay2 > by1:
            logger.debug(f"marking card={card.title} dirty")
            card.dirty = True
            return False
    return True

def intersection1d(a0, a1, b0, b1):
    if a0 >= b0 and a1 <= b1:
        i = a1 - a0
    elif a0 < b0 and a1 > b1:
        i = b1 - b0
    elif a0 < b0 and a1 > b0:
        i = a1 - b0
    elif a1 > b1 and a0 < b1:
        i = b1 - a0
    else:
        i = 0
    return i

def detect_collapsing(card, points):
    (card_width,card_height) = box_points_dims(card)
    (points_width,points_height) = box_points_dims(points)
    card_area = card_width * card_height
    points_area = points_width * points_height
    if points_area > card_area:
        return False
    width = intersection1d(card[0][0], card[3][0], points[0][0], points[3][0])
    height = intersection1d(card[0][1], card[3][1], points[0][1], points[3][1])
    intersect_area = width * height
    percent = intersect_area / points_area
    return percent > 0.80

def is_existing_card(cards, box_points):
    for card in cards:
        d = compute_distance(card.box_points, box_points)
        if d < 10:
            return True
        if detect_collapsing(card.box_points, box_points):
            return True
    return False


def check_for_candidate(cards, c):
    """
    Checks to see if the contour is a possible candidate card:
    Successful if not rotated at any angle, and no overlap with existing cards
    Returns box points (array of 4 points)
    """
    x,y,w,h = cv.boundingRect(c)
    bounding = to_box_points(x,y,w,h) # bounding: [[x,y], [x,y], [x,y], [x,y]]
    rect = cv.minAreaRect(c) # rect: ((cx, cy), (w, h), angle)
    rotated = cv.boxPoints(rect) # rotated: [[x,y], [x,y], [x,y], [x,y]]
    rotated = np.intp(rotated)
    total = compute_distance(bounding, rotated)
    if is_existing_card(cards, bounding):
#        logger.debug("found existing card")
        return None
    # instead of measuring distance, what about just checking the angle ?
    if no_overlap(cards, bounding) and total < 50:
        return bounding
    else:
        return None

class Detector:

    def __init__(self, backsub):
        self._backsub = backsub
        self._locked_cards = []
        self._stale_cards = []
        self._reference = None
        self._saved_candidate = None
        self._saved_count = 0

        self._state = "stabilizing"
        self._ratios = deque(maxlen=STABILIZE_MIN_FRAMES)


    def lookup_click(self, x, y):
        for card in self._locked_cards:
            box = card.box_points
            x1 = box[0][0]
            y1 = box[0][1]
            x2 = box[3][0]
            y2 = box[3][1]
            if x > x1 and x < x2 and y > y1 and y < y2:
                logger.debug(f"lookup_click: card={card.title}")
                return

    def search_click(self, frame, x, y):
        if not self._reference:
            return None

        (w, h) = self._reference
        cropped = frame[int(y-h/8):int(y+h/8), int(x-w/2):int(x+w/2)]
        title = self._recognize(cropped)

        return title

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
        #logger.debug(f"stabilizing: {this_ratio} {mean_ratio}")
        return mean_ratio < STABILIZE_RATIO and len(self._ratios) >= STABILIZE_MIN_FRAMES

    def _tighten(self, mask):
        # Morphological opening and closing to improve mask
        kernel = np.ones((5,5),np.uint8)
        mask = cv.morphologyEx(mask, cv.MORPH_OPEN, kernel)
        mask = cv.morphologyEx(mask, cv.MORPH_CLOSE, kernel)
        mask[mask < 255] = 0
        return mask

    def _is_locked(self, candidate):
        distance = compute_distance(candidate, self._saved_candidate)
        if distance < 10:
            self._saved_count = self._saved_count + 1
            return self._saved_count > 2
        else:
            self._saved_candidate = None
            self._saved_count = None
            return False

    def _update_cards(self, frame, output):
        keep = []
        for card in self._locked_cards:
            if card.dirty:
                card.dirty = False
                self._stale_cards.append(card)
            else:
                keep.append(card)
        self._locked_cards = keep

    def _recognize(self, cropped):
        if len(cropped) > 0:
            filename = get_card_filename()
            cv.imwrite(filename, cropped)
            text = vision.recognize(filename)
            if len(text) > 0:
                title = card_search.fuzzy_search(text)
                return title
        return None

    def _crop_card_title(self, image, w, h):
        return image[0:int(h/8), int(w/6):w]

    def _find_card_title(self, frame, candidate):
        x = candidate[0][0]
        y = candidate[0][1]
        w = candidate[3][0] - x
        h = candidate[3][1] - y
        whole = frame[y:y+h,x:x+w]
        if FEATURE_SAVE_IMAGES:
            cv.imwrite(get_card_filename(), whole)
        if h > w: # portrait
            cropped = self._crop_card_title(whole, w, h)
            return self._recognize(cropped)
        else:
            directions = [cv.ROTATE_90_CLOCKWISE, cv.ROTATE_90_COUNTERCLOCKWISE]
            rotations = [cv.rotate(whole, d) for d in directions]
            crops = [self._crop_card_title(r, w, h) for r in rotations]
            crops = [c for c in crops if len(c) > 0]
            texts = []
            for crop in crops:
                filename = get_card_filename()
                cv.imwrite(filename, crop)
                text = vision.recognize(filename)
                if len(text) > 0:
                    texts.append(text)
            return card_search.fuzzy_search_multiple(texts)

    def _save_card(self, frame):
        title = self._find_card_title(frame, self._saved_candidate)
        if title:
            logger.info(f"found card={title}")
            card = Card(title, self._saved_candidate)
            self._locked_cards.append(card)

    def _within_margin(self, c):
        """
        While calibrating returns true if contour area greater than MIN_CONTOUR_AREA
        After calibration, returns true if contour area within margin of reference
        """
        area = cv.contourArea(c)
        return area > MIN_CONTOUR_AREA
        if self._state == "calibrating":
            return area > MIN_CONTOUR_AREA
        if self._state == "detecting" and self._reference:
            reference = self._reference[0] * self._reference[1]
            logger.debug(f"checking margin: {reference}, {area}")
            return area > (reference - AREA_MARGIN) and area < (reference + AREA_MARGIN)
        return False

    def _check_stale_cards(self, frame):
        keep = []
        for card in self._stale_cards:
            title = self._find_card_title(frame, card.box_points)
            if title == card.title:
                logger.debug(f"refreshed card={card.title}")
                keep.append(card)
        self._locked_cards.extend(keep)
        self._stale_cards = []

    def detect(self, frame):
        output = frame.copy()

        mask = self._backsub.apply(frame, learningRate=LEARNING_RATE)
        mask = self._tighten(mask)

        candidate_contour = None
        non_candidates = []

        if self._state == "stabilizing":
            stabilized = self._has_stabilized(mask)
            if stabilized:
                logger.info("background stabilized")
                self._state = "calibrating"
        elif self._state == "calibrating" or self._state == "detecting":
            contours, hierarchy = cv.findContours(mask,cv.RETR_EXTERNAL,cv.CHAIN_APPROX_SIMPLE)
            # type of contours is tuple (of ndarray)
            contours = [ approx(c) for c in contours if self._within_margin(c) ]

            if len(contours) == 0 and len(self._stale_cards) > 0:
                self._check_stale_cards(frame)

            for c in contours:
                # type of c is numpy ndarray
                candidate = check_for_candidate(self._locked_cards, c)
                if candidate:
                    if not self._saved_candidate:
                        self._saved_candidate = candidate
                        self._saved_count = 0
                    elif self._is_locked(candidate):
                        if self._state == "calibrating":
                            self._state = "detecting"
                            self._reference = box_points_dims(candidate)
                            logger.info(f"finished calibrating: {self._reference}")
                        self._save_card(frame)
                        self._saved_candidate = None
                        self._saved_count = 0
                    else:
                        candidate_contour = c
                else:
                    non_candidates.append(c)

            self._update_cards(frame, output)

        return AppState(mask, candidate_contour, non_candidates, self._locked_cards, self._stale_cards, self._state)
