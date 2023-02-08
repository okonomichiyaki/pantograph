import requests
import json
import logging
import time
import sys

from pathlib import Path
from rapidfuzz import process
from rapidfuzz.distance.Levenshtein import distance
from dataclasses import dataclass

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
    results = sorted(results, key=lambda result: result[0]) # TODO: shouldn't this key on result[1] ?
    if len(results) > 0:
        title = results[0][0]
        card = cards[title]
        logger.debug(f"fuzzy_search_multiple: texts={repr(texts)} card={card} results={results}")
        return card
    else:
        return None

class CardSearch:
    def __init__(self, cards):
        self.cards = cards
        self.titles = [ card.get_simple_title() for card in cards.values() ]

    def text_search(self, text):
        return fuzzy_search(text, self.titles, self.cards)

    def text_search_multiple(self, texts):
        return fuzzy_search_multiple(texts, self.titles, self.cards)

def init_card_search():
    cards = get_active_cards()
    return CardSearch(cards)
