import pytest

from pantograph.card_search import fuzzy_search

def test_fuzzy_search_makers_eye():
    # text="N\nTHE MAKER'S EVE\nNSTELL"
    # text="2\nTHE MAKER'S ETE\nSPORT"
    text = "2\nTHE MAKER'S F\nScant "
    makers = 'The Maker\'s Eye'
    choices=['Synthetic Systems: The World Re-imagined', makers]
    result = fuzzy_search(text, titles=choices)
    assert result[0] == makers

def test_fuzzy_search_zenit():
    text = "884\nZENIT CHIP IZ-2M)"
    zenit = "Zenit Chip JZ-2MJ"
    choices = ['Brain Chip', 'Security Chip', 'Friday Chip', zenit, 'Unity']
    result = fuzzy_search(text, titles=choices)
    assert result[0] == zenit

def test_fuzzy_search_wake_implant():
    text="WAKE IMPLANT VIA-IRI"
    wake="WAKE Implant v2A-JRJ"
    choices=["Imp", "Wake Up Call", wake]
    result = fuzzy_search(text, titles=choices)
    assert result[0] == wake
