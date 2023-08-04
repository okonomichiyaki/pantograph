import requests
import json
import pprint
import sys
import logging
import argparse

from dataclasses import dataclass
from pathlib import Path
import urllib.request

API_URL = "https://netrunnerdb.com/api/2.0/public/"
IMG_URL = "https://card-images.netrunnerdb.com/v1/large/{code}.jpg"
CORP_FACTIONS = ["NBN", "Jinteki", "Haas-Bioroid", "Weyland Consortium"]
STARTUP = ["ph", "ms", "msbp", "su21", "sg", "tai"]  # pack codes

logger = logging.getLogger("pantograph")


@dataclass
class NrdbCard:
    title: str
    code: int
    img_url: str
    side_code: str
    type_code: str
    fmts: list[str]

    def get_titles(self):
        if ":" in self.title and self.type_code == "identity":
            parts = self.title.split(":")
            parts = [part.strip() for part in parts]
            if parts[0] in CORP_FACTIONS:
                return [parts[1]]
            else:
                return parts
        else:
            return [self.title]


def get_formats(card):
    if card["pack_code"] in STARTUP:
        return ["startup", "standard"]
    else:
        return ["standard"]


def from_hash(card):
    title = card["title"]
    code = card["code"]
    img_url = IMG_URL.replace("{code}", code)
    type_code = card["type_code"]
    side_code = card["side_code"]
    fmts = get_formats(card)
    return NrdbCard(title, int(code), img_url, side_code, type_code, fmts)


def get(url):
    response = requests.get(url)
    logger.info(f"requests.get {url}")
    if response.status_code == 200:
        return response.text
    else:
        return None


def load_or_request(url, filename):
    logger.info(f"load_or_request {url} {filename}")
    file = Path(filename)
    if file.is_file():
        with open(filename, "r", encoding="utf-8") as f:
            return json.load(f)
    else:
        text = get(url)
        if not text:
            return None
        with open(filename, "w", encoding="utf-8") as f:
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


def get_active_cycles():
    cycles = get_all_cycles()
    # filter out draft and napd multiplayer, which are not marked as rotated:
    cycles = [c for c in cycles if c["code"] not in ["draft", "napd"]]
    return [c["code"] for c in cycles if not c["rotated"]]


def get_all_packs():
    filename = "data/packs"
    url = API_URL + "packs"
    data = load_or_request(url, filename)
    return data["data"]


def get_active_packs():
    active_cycles = get_active_cycles()
    packs = get_all_packs()
    return [pack for pack in packs if pack["cycle_code"] in active_cycles]


def get_active_cards(raw=False):
    cards = get_all_cards()
    active_packs = get_active_packs()
    active_pack_codes = [pack["code"] for pack in active_packs]
    active_cards = [card for card in cards if card["pack_code"] in active_pack_codes]
    if raw:
        return active_cards
    else:
        return [from_hash(card) for card in active_cards]


def download_images(pack_code, path="."):
    cards = get_all_cards()
    cards = [card for card in cards if card["pack_code"] == pack_code]
    for card in cards:
        code = card["code"]
        img_url = IMG_URL.replace("{code}", code)
        filename = path + "/" + code + ".jpg"
        if Path(filename).is_file():
            print("Skipping " + filename)
        else:
            print("Downloading " + img_url)
            urllib.request.urlretrieve(img_url, filename)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="utility script for interacting with the NRDB API")
    parser.add_argument(
        "--download-pack",
        type=str,
        help="Specify pack code (eg \"tai\" for \"The Automata Initiative\") to download images"
    )
    parser.add_argument(
        "--download-path",
        type=str,
        help="Specified path to save images",
        default="."
    )
    parser.add_argument(
        "--search",
        type=str,
        help="Search for a card by title (exact match), pretty print JSON",
    )
    parser.add_argument(
        "--list-legal-packs",
        action="store_true",
        help="List pack codes not marked for rotation (standard legal)",
    )
    args = parser.parse_args()

    if args.download_pack:
        download_images(args.download_pack, args.download_path)
        exit(0)

    if args.search:
        pp = pprint.PrettyPrinter(indent=4)
        cards = get_active_cards(raw=True)
        cards = [card for card in cards if args.search.lower() in card["title"].lower()]
        for card in cards:
            pp.pprint(card)
        exit(0)

    if args.list_legal_packs:
        active_cycles = get_active_cycles()
        packs = get_all_packs()
        for pack in packs:
            if pack["cycle_code"] in active_cycles:
                name = pack["name"]
                code = pack["code"]
                cycle = pack["cycle_code"]
                print(f"{name} - {code} - {cycle}")

        exit(0)
