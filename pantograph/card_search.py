import requests
import json
import logging
import imagehash
import time
import sys

from pathlib import Path
from rapidfuzz import process
from rapidfuzz.distance.Levenshtein import distance
from dataclasses import dataclass
from PIL import Image
import numpy as np

from pantograph.nrdb import get_active_cards


logger = logging.getLogger("pantograph")


def _extract(text, titles):
    return process.extract(text, titles, limit=5, scorer=distance)

def fuzzy_search(text, titles, cards):
    results = _extract(text, titles)
    if len(results) > 0:
        title = results[0][0]
        card = cards[title]
        logger.debug(f"fuzzy_search: text={repr(text)} card={card} results={results}")
        return card
    else:
        return None

def fuzzy_search_multiple(texts, titles, cards):
    results = [_extract(text, titles) for text in texts]
    results = [result[0] for result in results]
    results = sorted(results, key=lambda result: result[0])
    if len(results) > 0:
        title = results[0][0]
        card = cards[title]
        logger.debug(f"fuzzy_search_multiple: texts={repr(texts)} card={card} results={results}")
        return card
    else:
        return None

def combined_hash(img):
    p = imagehash.phash(img)
    c = imagehash.colorhash(img)
    return (p,c)

def diff_hash(a, b):
    pdiff = a[0] - b[0]
    cdiff = a[1] - b[1]
    return pdiff + cdiff

def build_image_hash_db(imagesdir, cards, hashfunc=imagehash.phash):
    start = time.perf_counter()

    path = Path(imagesdir)
    if '~' in imagesdir:
        path = path.expanduser()
    filenames = path.glob('**/*.jpg')
    hashes = []
    for f in sorted(filenames):
        try:
            hash = hashfunc(Image.open(f))
            code = int(f.name[0:-4])
            data = cards[code]
            hashes.append((hash, data))
        except Exception as e:
            logging.error(f"Caught exception computing hash for {f}: ", e)
            continue

    elapsed = time.perf_counter() - start
    logger.info(f"built hash database in {elapsed}")
    return hashes

def search_by_image_hash(imgpath, hashes, hashfunc=imagehash.phash):
    start = time.perf_counter()

    target = hashfunc(Image.open(imgpath))
    results = sorted(hashes, key=lambda h: diff_hash(target, h[0]))
    best = results[:5]
    best = [ b[1].title for b in best ]
    logger.debug(f"best results: {best}")

    return results[0][1]
    # closest = (np.inf, None)
    # for hash in hashes:
    #     other = hash[0]
    #     data = hash[1]
    #     diff = other - target
    #     if diff < closest[0]:
    #         closest = (diff, data)

    # elapsed = time.perf_counter() - start
    # logger.debug(f"found closest {closest} in {elapsed}")
    # return closest[1]

class CardSearch:
    def __init__(self, cards, imgdir, hashfunc=combined_hash):
        self.cards = cards
        self.titles = [ card.get_simple_title() for card in cards.values() ]
        if imgdir:
            self.hashes = build_image_hash_db(imgdir, cards, hashfunc=hashfunc)
            self._hashfunc = hashfunc

    def image_search(self, imgpath):
        if self.hashes:
            return search_by_image_hash(imgpath, self.hashes, hashfunc=self._hashfunc)
        else:
            logger.error("No image hash database created")
            return None

    def text_search(self, text):
        return fuzzy_search(text, self.titles, self.cards)

    def text_search_multiple(self, texts):
        return fuzzy_search_multiple(texts, self.titles, self.cards)

# TODO: NRDB API code take data dir param
def init_card_search(datadir=None, imagesdir=None):
    cards = get_active_cards()
    return CardSearch(cards, imagesdir)
