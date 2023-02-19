import shapely.geometry
import cv2 as cv
import numpy as np
import logging
import base64
from collections import Counter

import pantograph.google_vision as vision

logger = logging.getLogger("pantograph")

class Calibration:
    def __init__(self, w, h):
        self.w = w;
        self.h = h;

    @property
    def t(self):
        return self.h / 10

DEFAULT = Calibration(100, 200)

def draw_laser_point(img, x, y, color):
    cv.rectangle(img, [x,y], [x+3,y+3], color)

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

def get_ice_titles(x, y, w, h, calibration=DEFAULT):
    left = [
        [x-int(h/2),y-int(w/2)],
        [x-int(h/2),y+int(w/2)],
        [x-int(h/2)+2*calibration.t,y+int(w/2)],
        [x-int(h/2)+2*calibration.t,y-int(w/2)],
    ]
    right = [
        [x+int(h/2),y-int(w/2)],
        [x+int(h/2),y+int(w/2)],
        [x+int(h/2)-2*calibration.t,y+int(w/2)],
        [x+int(h/2)-2*calibration.t,y-int(w/2)],
    ]
    return [right, left]

def get_texts(rotation, blocks, areas):
    reasons = []

    def filter(block):
        if rotation != block.rotation:
            reasons.append((block,'rotation'))
            return False
        if block.text.isdigit():
            reasons.append((block,'digit'))
            return False
        if len(block.text) < 2:
            reasons.append((block,'length'))
            return False
        box = shapely.geometry.Polygon(block.points)
        intersect = any([shapely.intersects(area, box) for area in areas])
        if not intersect:
            reasons.append((block,'nointersect'))
        else:
            reasons.append((block,'intersect'))
        return intersect

    all_texts = [block.text for block in blocks]
    filtered = [block.text for block in blocks if filter(block)]

    return (filtered, all_texts, reasons)

def search(img_bytes, debug=False, visual_debug=False, calibration=DEFAULT):
    if debug:
        with open('card.jpg', 'wb') as f:
            f.write(img_bytes)
    blocks = vision.recognize_bytes(img_bytes)
    if (len(blocks) < 1):
        return []
    img = cv.imdecode(np.frombuffer(img_bytes, np.uint8), -1)
    copy = img.copy()
    (w,h,*_) = img.shape
    x=int(w/2)
    y=int(h/2)
    rotation = detect_rotation(blocks)
    if rotation == 0: # upright
        pts = get_tri_points(x, y, calibration.w, calibration.h)
        cv.polylines(copy, [np.array(pts, dtype=np.int32)], True, (0, 0, 255))
        uptri = shapely.geometry.Polygon(pts)
        pts = np.array([
            [x-int(calibration.w/2),y-2*calibration.t],
            [x-int(calibration.w/2),y+2*calibration.t],
            [x+int(calibration.w/2),y+2*calibration.t],
            [x+int(calibration.w/2),y-2*calibration.t]
        ], np.int32)
        cv.polylines(copy, [pts], True, (255, 0, 0))
        midbox = shapely.geometry.Polygon(pts)
        areas = [midbox, uptri]
    elif rotation == 90 or rotation == 270:
        titles = get_ice_titles(x, y, calibration.w, calibration.h, calibration)
        for pts in titles:
            cv.polylines(copy, [np.array(pts, dtype=np.int32)], True, (255, 0, 0))
        areas = [ shapely.geometry.Polygon(t) for t in titles ]
    else:
        # TODO handle upside down card
        areas = []

    for block in blocks:
        box = shapely.geometry.Polygon(block.points)
        intersect = any([shapely.intersects(area, box) for area in areas])
        if intersect:
            cv.polylines(copy, [np.array(block.points, dtype=np.int32)], True, (0, 255, 0))

    if visual_debug:
        cv.imshow('', copy)
        cv.waitKey(0)

    retval, buf = cv.imencode('.jpg', copy)
    b64 = base64.b64encode(buf).decode('ascii')
    (filtered, all_texts, reasons) = get_texts(rotation, blocks, areas)
    return {
        "rotation": rotation,
        "filtered": filtered,
        "allTexts": all_texts,
        "reasons": [ (b.text.replace("\n","_"),r) for (b,r) in reasons ],
        "img": b64
    }
