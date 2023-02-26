import requests
import json
import logging
import time
import sys
import itertools

from pathlib import Path
from rapidfuzz import process
from rapidfuzz.distance.Levenshtein import distance
from dataclasses import dataclass

from pantograph.nrdb import get_active_cards
from pantograph.utils import flatmap

logger = logging.getLogger("pantograph")


@dataclass
class Result:
    orig: str
    title: str
    dist: int


class FuzzySearch:
    """
    Fuzzy search over NR card titles
    Performs some data massaging to improve matching
    """

    def __init__(self, active_cards=None):
        if active_cards != None and len(active_cards) > 1:
            self._init_cards(active_cards)
        else:
            self.cards = None
            self._titles = None

    def _get_titles(self, cards, fmt):
        cards = [c for c in cards if fmt in c.fmts]
        runner = [c for c in cards if c.side_code == "runner"]
        corp = [c for c in cards if c.side_code == "corp"]
        return {
            "runner": flatmap(lambda c: c.get_titles(), runner),
            "corp": flatmap(lambda c: c.get_titles(), corp),
            "both": flatmap(lambda c: c.get_titles(), cards),
        }

    def _init_cards(self, cards):
        result = {}
        for card in cards:
            result[card.title] = card
            for title in card.get_titles():
                result[title] = card
            result[int(card.code)] = card
        self.cards = result
        standard = self._get_titles(cards, "standard")
        startup = self._get_titles(cards, "startup")
        self._titles = {"standard": standard, "startup": startup}

    def _fetch_and_init(self):
        if self.cards != None:
            return
        start = time.perf_counter()
        active_cards = get_active_cards()
        self._init_cards(active_cards)
        logger.info(f"initialized fuzzy card search in {time.perf_counter() - start}")

    def _extract(self, text, titles):
        results = process.extract(text, titles, limit=5, scorer=distance)
        return [Result(text, result, d) for (result, d, x) in results]

    def search(self, text, side=None, fmt=None):
        if side is None:
            side = "both"
        if fmt is None:
            fmt = "startup"
        self._fetch_and_init()
        results = self._extract(text, self._titles[fmt][side])
        return [(self.cards[result.title], result) for result in results]

    # for each input text, take best result, then sort. uncertain if best approach
    def search_multiple(self, texts, side=None, fmt=None):
        if side is None:
            side = "both"
        if fmt is None:
            fmt = "startup"
        self._fetch_and_init()

        results = [self._extract(text, self._titles[fmt][side]) for text in texts]
        results = [result[0] for result in results]
        results = [result for result in results if len(result.orig) > result.dist and len(result.title) > result.dist]
        results = sorted(results, key=lambda result: result.dist)
        results = [(self.cards[result.title], result) for result in results]
        return results
