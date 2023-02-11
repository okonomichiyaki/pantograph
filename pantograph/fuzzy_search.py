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

logger = logging.getLogger("pantograph")

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
            self.titles = None

    def _init_cards(self, cards):
        result = {}
        for card in cards:
            result[card.title] = card
            for title in card.get_titles():
                result[title] = card
            result[int(card.code)] = card
        self.cards = result
        titles = [card.get_titles() for card in cards]
        self.titles = list(itertools.chain.from_iterable(titles))

    def _fetch_and_init(self):
        if self.cards != None:
            return
        logging.getLogger("pantograph").debug("fetch and init")

        start = time.perf_counter()

        active_cards = get_active_cards()
        self._init_cards(active_cards)

        logger.debug(f"initialized fuzzy card search in {time.perf_counter() - start}")

    def _extract(self, text, titles):
        return process.extract(text, titles, limit=5, scorer=distance)

    def search(self, text):
        self._fetch_and_init()
        results = self._extract(text, self.titles)
        if len(results) > 0:
            title = results[0][0]
            card = self.cards[title]
            logger.debug(f"fuzzy_search: text={repr(text)} card={card} results={results}")
            return card
        else:
            return None

    def search_multiple(self, texts):
        self._fetch_and_init()
        results = [self._extract(text, self.titles) for text in texts]
        results = [result[0] for result in results]
        results = sorted(results, key=lambda result: result[1])
        if len(results) > 0:
            title = results[0][0]
            card = self.cards[title]
            logger.debug(f"fuzzy_search_multiple: texts={repr(texts)} card={card} results={results}")
            return card
        else:
            return None
