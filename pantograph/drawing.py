import cv2 as cv
import numpy as np


BLUE = (255,0,0)
GREEN = (0,255,0)
RED = (0,0,255)
YELLOW = (0,255,255)
FUSCHIA = (255,0,255)


def draw(state, output):
    c = state.candidate_contour
    if c is not None:
        draw_candidate(output, c, YELLOW)
    for nc in state.non_candidates:
        draw_non_candidate(output, nc)
    for card in state.locked_cards:
        draw_card(output, card, GREEN)
    for card in state.stale_cards:
        draw_card(output, card, FUSCHIA)


def draw_candidate(output, c, color):
    x,y,w,h = cv.boundingRect(c)
    cv.rectangle(output,(x,y),(x+w,y+h),color,2)


def draw_non_candidate(output, c):
    x,y,w,h = cv.boundingRect(c)
    rect = cv.minAreaRect(c)
    box = cv.boxPoints(rect)
    box = np.intp(box)
    cv.rectangle(output,(x,y),(x+w,y+h),RED,2)
    cv.drawContours(output,[box],0,BLUE,2)


def draw_card(output, card, color):
    box = card.box_points
    x1 = box[0][0]
    y1 = box[0][1]
    x2 = box[3][0]
    y2 = box[3][1]
    cv.rectangle(output,(x1,y1),(x2,y2),color,2)
