import cv2 as cv
import numpy as np

def clahe(img):
    lab = cv.cvtColor(img, cv.COLOR_BGR2LAB)
    L,a,b = cv.split(lab)
    clahe = cv.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
    L2 = clahe.apply(L)
    img2 = cv.merge((L2,a,b))
    img2 = cv.cvtColor(img2, cv.COLOR_LAB2BGR)
    return img2
