# pantograph

play paper netrunner via webcam

see the demo live [here](https://pantograph.cbgpnck.net/app/demo/)

## running locally

dependencies:

- install [Python 3.10](https://realpython.com/intro-to-pyenv/) and [Poetry](https://python-poetry.org/)
- install and start [MongoDB](https://www.mongodb.com/docs/manual/tutorial/install-mongodb-on-os-x/)
- get an API key from [Metered](https://www.metered.ca/)
- get an API key from [Google Vision](https://cloud.google.com/vision/)

fetch dependencies: `poetry install`

run: `export METERED_API_KEY=<metered>; export VISION_API_KEY=<google>; poetry run gunicorn -k geventwebsocket.gunicorn.workers.GeventWebSocketWorker -w 1 pantograph.flask:app`

## tests

there are two small tests suites: python tests using pytest and end-to-end tests using cypress.
The end-to-end tests require the server running as above, including Google API key

To run python tests: `poetry run pytest`

To run end-to-end tests:

- install cypress via `npm install`
- then run the tests via `npx cypress run` or through the cypress UI (`npx cypress open`)

## contributing / development

enable debug mode by appending `?debug-mode=true` to any room (including demo).
this will display debugging information, mostly related to the card search, below the main div (scroll down)

set up [pre-commit](https://pre-commit.com/) to automatically format with [black](https://black.readthedocs.io/en/stable/)

## updating for new releases

steps to manually update to support new releases from NSG:

1. download images: `mkdir /tmp/images; poetry run python pantograph/nrdb.py --download-pack <pack code> --download-path /tmp/images`
2. upload to Google: `gcloud storage cp --recursive /tmp/images gs://netrunner-cards`
3. update card pool for Startup in `./pantograph/nrdb.py` (Standard relies on NRDB rotation)
