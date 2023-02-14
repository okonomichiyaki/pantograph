import shapely.geometry
import cv2 as cv
import numpy as np
import logging
from collections import Counter

import pantograph.google_vision as vision

logger = logging.getLogger("pantograph")

# TODO: this will come from calibration:
WIDTH = 138
HEIGHT = 183
TITLE = HEIGHT / 10

def detect_rotation(blocks):
    rotations = [block.rotation for block in blocks]
    counter = Counter(rotations)
    most_common = counter.most_common(1)
    return most_common[0][0]

def get_tri_points(cx, cy, w, h):
    origin = [cx, cy]
    points = [
        origin,
        [cx-int(w/2),cy-int(h/2)],
        [cx+int(w/2),cy-int(h/2)]
    ]
    return points

def get_ice_titles(x, y, w, h):
    left = shapely.geometry.Polygon([
        [x-int(h/2),y-int(w/2)],
        [x-int(h/2),y+int(w/2)],
        [x-int(h/2)+2*TITLE,y-int(w/2)],
        [x-int(h/2)+2*TITLE,y+int(w/2)],
    ])
    right = shapely.geometry.Polygon([
        [x+int(h/2),y-int(w/2)],
        [x+int(h/2),y+int(w/2)],
        [x+int(h/2)-2*TITLE,y-int(w/2)],
        [x+int(h/2)-2*TITLE,y+int(w/2)],
    ])
    return [right, left]

def draw_laser_point(img, x, y, color):
    cv.rectangle(img, [x,y], [x+3,y+3], color)

def get_texts(rotation, blocks, areas):
    def filter(block):
        if rotation != block.rotation:
            return False
        if block.text.isdigit():
            return False
        if len(block.text) < 2:
            return False
        return True
        # box = shapely.geometry.Polygon(block.points)
        # intersect = any([shapely.intersects(area, box) for area in areas])
        # if not intersect:
        #     logger.debug(f"filtering {block.text} for intersect")
        # return intersect
    logger.debug(f"all texts: {[block.text for block in blocks]}")
    filtered = [block.text for block in blocks if filter(block)]
    logger.debug(f"filtered texts: {filtered}")
    return filtered

def search(img_bytes):
    # TODO: only write if debug mode
    # with open('card.jpg', 'wb') as f:
    #     f.write(img_bytes)
    blocks = vision.recognize_bytes(img_bytes)
    if (len(blocks) < 1):
        return []
    img = cv.imdecode(np.frombuffer(img_bytes, np.uint8), -1)
    # copy = img.copy()
    (w,h,*_) = img.shape
    x=int(w/2)
    y=int(h/2)
    rotation = detect_rotation(blocks)
    logger.debug(f"detected rotation: {rotation}")
    if rotation == 0: # upright
        pts = get_tri_points(x, y, WIDTH, HEIGHT)
        # cv.polylines(copy, [np.array(pts, dtype=np.int32)], True, (0, 0, 255))
        uptri = shapely.geometry.Polygon(pts)
        pts = np.array([
            [x-int(WIDTH/2),y-2*TITLE],
            [x-int(WIDTH/2),y+2*TITLE],
            [x+int(WIDTH/2),y+2*TITLE],
            [x+int(WIDTH/2),y-2*TITLE]
        ], np.int32)
        # cv.polylines(copy, [pts], True, (255, 0, 0))
        midbox = shapely.geometry.Polygon(pts)
        areas = [midbox, uptri]
    elif rotation == 90 or rotation == 270:
        areas = get_ice_titles(x, y, WIDTH, HEIGHT)
    else:
        # TODO handle upside down card
        areas = []

    # cv.imshow('', copy)
    # cv.waitKey(0)
    return get_texts(rotation, blocks, areas)
