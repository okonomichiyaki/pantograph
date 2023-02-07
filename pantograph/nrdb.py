import requests
import json

from dataclasses import dataclass
from pathlib import Path

API_URL = "https://netrunnerdb.com/api/2.0/public/"
IMG_URL = "https://static.nrdbassets.com/v1/large/{code}.jpg"

@dataclass
class NrdbCard:
    title: str
    code: int
    img_url: str
    side_code: str
    type_code: str

    def get_simple_title(self):
        if ':' in self.title and self.type_code == 'identity':
            parts = self.title.split(':')
            return parts[0]
        else:
            return self.title

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

def get_active_cards():
    cards = get_all_cards()
    active_packs = get_active_packs()
    active_pack_codes = [ pack["code"] for pack in active_packs ]
    cards = [ card for card in cards if card["pack_code"] in active_pack_codes ]
    result = {}
    for card in cards:
        title = card["title"]
        code = card["code"]
        img_url = IMG_URL.replace("{code}", code)
        type_code = card["type_code"]
        side_code = card["side_code"]
        nc = NrdbCard(title, int(code), img_url, side_code, type_code)
        result[title] = nc
        result[nc.get_simple_title()] = nc
        result[int(code)] = nc
    return result
