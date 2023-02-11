import pytest

from pantograph.nrdb import NrdbCard

def test_get_titles_corps():
    card = NrdbCard("NBN: Reality Plus", None, None, None, "identity")
    assert card.get_titles() == ["Reality Plus"]
    card = NrdbCard("Haas-Bioroid: Precision Design", None, None, None, "identity")
    assert card.get_titles() == ["Precision Design"]
    card = NrdbCard("Jinteki: Restoring Humanity", None, None, None, "identity")
    assert card.get_titles() == ["Restoring Humanity"]
    card = NrdbCard("Weyland Consortium: Built to Last", None, None, None, "identity")
    assert card.get_titles() == ["Built to Last"]

def test_get_titles_runners():
    card = NrdbCard("Esâ Afontov: Eco-Insurrectionist", None, None, None, "identity")
    assert card.get_titles() == ["Esâ Afontov", "Eco-Insurrectionist"]
    card = NrdbCard("Zahya Sadeghi: Versatile Smuggler", None, None, None, "identity")
    assert card.get_titles() == ["Zahya Sadeghi", "Versatile Smuggler"]
    card = NrdbCard("Tāo Salonga: Telepresence Magician", None, None, None, "identity")
    assert card.get_titles() == ["Tāo Salonga", "Telepresence Magician"]
