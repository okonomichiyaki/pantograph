import requests
from pathlib import Path
import json
from rapidfuzz import process
from rapidfuzz.distance.Levenshtein import distance

API_URL = "https://netrunnerdb.com/api/2.0/public/"

def get(url):
    response = requests.get(url)
    if response.status_code == 200:
        return response.text
    else:
        return None

def load_or_request(url, filename):
    file = Path(filename)
    if file.is_file():
        with open(filename, 'r', encoding="utf-8") as f:
            return json.load(f)
    else:
        text = get(url)
        if not text:
            return None
        with open(filename, 'w', encoding="utf-8") as f:
            f.write(text)
        return json.loads(text)

def fetch(base, path, tail):
    filename = "data/" + path + tail
    url = base + path + tail
    Path("data/" + path).mkdir(parents=True, exist_ok=True)
    return load_or_request(url, filename)

def get_card(code):
    path = "card/"
    tail = str(code)
    data = fetch(API_URL, path, tail)
    return data["data"][0]

def get_all_cards():
    path = ""
    tail = "cards"
    data = fetch(API_URL, path, tail)
    return data["data"]

def get_pack(code):
    path = "pack/"
    tail = str(code)
    data = fetch(API_URL, path, tail)
    return data["data"][0]

def get_all_cycles():
    filename = "data/cycles"
    url = API_URL + "cycles"
    data = load_or_request(url, filename)
    return data["data"]

def get_all_packs():
    filename = "data/packs"
    url = API_URL + "packs"
    data = load_or_request(url, filename)
    return data["data"]

def get_active_packs():
    cycles = get_all_cycles()
    active_cycles = [ cycle["code"] for cycle in cycles if not cycle["rotated"] ]
    packs = get_all_packs()
    return [ pack for pack in packs if pack["cycle_code"] in active_cycles ]

def get_active_card_titles():
    cards = get_all_cards()
    active_packs = get_active_packs()
    active_pack_codes = [ pack["code"] for pack in active_packs ]
    titles = [ card["title"] for card in cards if card["pack_code"] in active_pack_codes ]
    return titles

_titles = get_active_card_titles()

def fuzzy_search(text, titles=_titles):
    results = process.extract(text, titles, limit=5, scorer=distance)
    print(f"fuzzy_search: text={repr(text)} results={results}")
    return results[0]
