import requests
import json
import pprint
import sys
import logging
import argparse
import time

from dataclasses import dataclass
from pathlib import Path
import urllib.request

APIv3_URL = "https://api-preview.netrunnerdb.com/api/v3/public/"
IMG_URL = "https://card-images.netrunnerdb.com/v2/large/{code}.jpg"
CORP_FACTIONS = ["NBN", "Jinteki", "Haas-Bioroid", "Weyland Consortium"]

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
        if ":" in self.title and "identity" in self.type_code:
            parts = self.title.split(":")
            parts = [part.strip() for part in parts]
            if parts[0] in CORP_FACTIONS:
                return [parts[1]]
            else:
                return parts
        else:
            return [self.title]


def get_card_formats(pools, card):
    if "startup" in card["attributes"]["format_ids"]:
        return ["startup", "standard"]
    else:
        return ["standard"]


def from_hash(pools, card):
    title = card["attributes"]["title"]
    code = card["attributes"]["printing_ids"][0]  # TODO first or last? (eg for SU21)
    img_url = IMG_URL.replace("{code}", code)
    type_code = card["attributes"]["card_type_id"]
    side_code = card["attributes"]["side_id"]
    fmts = get_card_formats(pools, card)
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


def fetch(base, path):
    filename = "data/" + path.replace("/", "_")
    url = base + path
    Path("data/").mkdir(parents=True, exist_ok=True)
    return load_or_request(url, filename)


def get_all_cards():
    i = 0
    filename = f"data/all_cards_page_{i}"
    url = APIv3_URL + "/cards"
    page = load_or_request(url, filename)
    results = page["data"]
    while "next" in page["links"]:
        i = i + 1
        filename = f"data/all_cards_page_{i}"
        url = page["links"]["next"]
        page = load_or_request(url, filename)
        results.extend(page["data"])
    return [card for card in results]


def get_card_pool(id):
    path = f"card_pools/{id}"
    return fetch(APIv3_URL, path)


def get_latest_card_pool(format):
    format = get_format(format)
    id = format["attributes"]["active_card_pool_id"]
    return get_card_pool(id)


def get_formats():
    path = "formats"
    data = fetch(APIv3_URL, path)
    return data


def get_format(format):
    formats = get_formats()
    filtered = [
        f for f in formats["data"] if f["attributes"]["name"].lower() == format.lower()
    ]
    if len(filtered) > 0:
        return filtered[0]
    else:
        return None


def get_format_names():
    formats = get_formats()
    return [f["attributes"]["name"] for f in formats["data"]]


def get_latest_card_pools():
    return {
        "startup": get_latest_card_pool("startup"),
        "standard": get_latest_card_pool("standard"),
    }


def get_card_sets():
    path = "card_sets"
    data = fetch(APIv3_URL, path)
    return sorted(data["data"], key=lambda s: s["attributes"]["date_release"])


def get_active_cards(raw=False):
    pools = get_latest_card_pools()
    cards = get_all_cards()
    active_cards = [
        card for card in cards if "standard" in card["attributes"]["format_ids"]
    ]
    if raw:
        return active_cards
    else:
        return [from_hash(pools, card) for card in active_cards]


def download_images(set_id, path="."):
    cards = get_all_cards()
    cards = [card for card in cards if set_id in card["attributes"]["card_set_ids"]]
    for card in cards:
        code = card["attributes"]["printing_ids"][0]  # TODO
        img_url = IMG_URL.replace("{code}", code)
        filename = path + "/" + code + ".jpg"
        if Path(filename).is_file():
            print("Skipping " + filename)
        else:
            print("Downloading " + img_url)
            urllib.request.urlretrieve(img_url, filename)
            time.sleep(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="utility script for interacting with the NRDB API"
    )
    parser.add_argument(
        "--download-set",
        type=str,
        help='Specify set ID (eg "the_automata_initiative" for "The Automata Initiative") to download images',
    )
    parser.add_argument(
        "--download-path", type=str, help="Specified path to save images", default="."
    )
    parser.add_argument(
        "--search",
        type=str,
        help="Search for a card by title (exact match), pretty print JSON",
    )
    parser.add_argument(
        "--raw",
        action="store_true",
        help="If present, pretty print raw JSON from the API",
    )
    parser.add_argument(
        "--list-all-card-sets", action="store_true", help="List all card set names"
    )
    parser.add_argument(
        "--list-format",
        type=str,
        help="List formats and their details",
    )
    parser.add_argument(
        "--list-card-pool",
        type=str,
        help="List the card pool for a format",
    )
    args = parser.parse_args()
    pp = pprint.PrettyPrinter(indent=4)

    if args.download_set:
        download_images(args.download_set, args.download_path)
        exit(0)

    if args.search and args.raw:
        cards = get_active_cards(raw=True)
        cards = [
            card
            for card in cards
            if args.search.lower() in card["attributes"]["title"].lower()
        ]
        for card in cards:
            pp.pprint(card)
        exit(0)

    if args.search:
        cards = get_active_cards(raw=False)
        cards = [card for card in cards if args.search.lower() in card.title.lower()]
        for card in cards:
            pp.pprint(card)
        exit(0)

    if args.list_all_card_sets:
        sets = get_card_sets()
        for sid in [s["id"] for s in sets]:
            print(sid)
        exit(0)

    if args.list_format:
        format = get_format(args.list_format)
        if format:
            pp.pprint(format)
        else:
            print("Format not found:", args.list_format)
            print("Valid formats:", ", ".join(get_format_names()))
        exit(0)

    if args.list_card_pool:
        pool = get_latest_card_pool(args.list_card_pool)
        pp.pprint(pool)
        exit(0)
