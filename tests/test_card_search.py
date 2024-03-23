import pytest
import logging

from pantograph.fuzzy_search import FuzzySearch
from pantograph.nrdb import NrdbCard

logging.basicConfig(level=logging.DEBUG)


def test_fuzzy_search_makers_eye():
    # text="N\nTHE MAKER'S EVE\nNSTELL"
    # text="2\nTHE MAKER'S ETE\nSPORT"
    text = "2\nTHE MAKER'S F\nScant "
    makers = "The Maker's Eye"
    titles = ["Synthetic Systems: The World Re-imagined", makers]
    fuzzy = FuzzySearch(
        [
            NrdbCard(
                title,
                123,
                "http://example.com/image.jpg",
                "runner",
                "type",
                ["startup"],
            )
            for title in titles
        ]
    )
    result = fuzzy.search(text)
    assert len(result) > 0
    result = result[0][0]
    assert result.title == makers


def test_fuzzy_search_zenit():
    text = "884\nZENIT CHIP IZ-2M)"
    zenit = "Zenit Chip JZ-2MJ"
    titles = ["Brain Chip", "Security Chip", "Friday Chip", zenit, "Unity"]
    fuzzy = FuzzySearch(
        [
            NrdbCard(
                title,
                123,
                "http://example.com/image.jpg",
                "runner",
                "type",
                ["startup"],
            )
            for title in titles
        ]
    )
    logger = logging.getLogger("pantograph")
    logger.debug(fuzzy.cards)
    result = fuzzy.search(text)
    assert len(result) > 0
    result = result[0][0]
    assert result.title == zenit


def test_fuzzy_search_wake_implant():
    text = "WAKE IMPLANT VIA-IRI"
    wake = "WAKE Implant v2A-JRJ"
    titles = ["Imp", "Wake Up Call", wake]
    fuzzy = FuzzySearch(
        [
            NrdbCard(
                title,
                123,
                "http://example.com/image.jpg",
                "runner",
                "type",
                ["startup"],
            )
            for title in titles
        ]
    )
    result = fuzzy.search(text)
    assert len(result) > 0
    result = result[0][0]
    assert result.title == wake
