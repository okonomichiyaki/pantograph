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
            card["fresh"] = True
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

def loop(backsub, capture):
    show_mask = False
    paused = False
    last_contours = None
    contour_idx = 0
    last_frame = None

    saved_candidate = None
    saved_count = 0

    cards = []


    while True:
        if paused:
            keyboard = cv.waitKey(30)
            if keyboard == 32: # space
                contour_idx = 0
                paused = not paused
            if keyboard == 110: # n key
                contour_idx = min(contour_idx + 1, len(last_contours) - 1)
                c = last_contours[contour_idx]
                print(cv.contourArea(c))
            if keyboard == 112: # p key
                contour_idx = max(0, contour_idx - 1)
                c = last_contours[contour_idx]
                print(cv.contourArea(c))

            output = last_frame.copy()
            output_contours = [last_contours[contour_idx]]
            cv.drawContours(output, output_contours, -1, (0,255,0), 3)
            cv.imshow('', output)
        else:
            ret, frame = capture.read()

            if frame is None:
                break

            mask = backsub.apply(frame, learningRate=0.001)

            # Morphological opening and closing to improve mask
            kernel = np.ones((5,5),np.uint8)
            mask_morph = cv.morphologyEx(mask, cv.MORPH_OPEN, kernel)
            mask_morph = cv.morphologyEx(mask_morph, cv.MORPH_CLOSE, kernel)
            #print(f"max={mask_morph.max()} min={mask_morph.min()}")
            mask_morph[mask_morph < 255] = 0
    #        print(mask_morph.dtype)

            contours, hierarchy = cv.findContours(mask_morph,cv.RETR_EXTERNAL,cv.CHAIN_APPROX_SIMPLE)

            output = frame.copy()

            contours = [approx(c) for c in contours if cv.contourArea(c) > 10000 ]

            for c in contours:
                candidate = check_for_candidate(cards, c)
                if candidate:
                    if not saved_candidate:
                        saved_candidate = candidate
                        saved_count = 0
                    else:
                        distance = compute_distance(candidate, saved_candidate)
                        if distance < 10:
                            saved_count = saved_count + 1
                            if saved_count > 5:
                                card = {"box": saved_candidate, "fresh": True}
                                cards.append(card)
                                x = saved_candidate[0][0]
                                y = saved_candidate[0][1]
                                w = saved_candidate[3][0] - x
                                h = saved_candidate[3][1] - y
                                cropped = frame[y:int(y+(h/2)), x:x+w]
                                cv.imwrite("card.jpg", cropped)
                                text = vision.recognize("card.jpg")
                                title = card_search.fuzzy_search(text)
                                print(f"found a card? {title}")
                                saved_candidate = None
                                saved_count = 0
                        else:
                            saved_candidate = candidate
                            saved_count = 0
                    x,y,w,h = cv.boundingRect(c)
                    cv.rectangle(output,(x,y),(x+w,y+h),(0,255,255),2)
                else:
                    x,y,w,h = cv.boundingRect(c)
                    rect = cv.minAreaRect(c)
                    box = cv.boxPoints(rect)
                    box = np.intp(box)
                    if no_overlap(cards, box):
                        cv.rectangle(output,(x,y),(x+w,y+h),(0,0,255),2)
                        cv.drawContours(output,[box],0,(255,0,0),2)

            fresh_cards = [card for card in cards if card["fresh"]]
            for card in fresh_cards:
                card["fresh"] = False
                box = card["box"]
                x1 = box[0][0]
                y1 = box[0][1]
                x2 = box[3][0]
                y2 = box[3][1]
                cv.rectangle(output,(x1,y1),(x2,y2),(0,255,0),2)
            cards = fresh_cards

            #contours = [c for c in contours if  cv.contourArea(c) > 10000]
    #        cv.drawContours(output, contours, -1, (0,255,0), 3)
            #output = cv.bitwise_and(frame, frame, None, mask_morph)

            if show_mask:
                cv.imshow('', mask_morph)
            else:
                cv.imshow('', output)

            last_frame = frame
            last_contours = contours

            keyboard = cv.waitKey(30)
            # if keyboard != -1:
            #     print(keyboard)
            if keyboard == 32 and len(last_contours) > 0: # space
                paused = not paused
            if keyboard == 27: # escape
                break
            if keyboard == 109: # m key
                show_mask = not show_mask
