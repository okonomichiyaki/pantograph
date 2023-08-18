# pantograph

play paper netrunner via webcam

see the demo live [here](https://pantograph.cbgpnck.net/app/demo/)

## running locally

dependencies:

- install python and poetry
- [install and start MongoDB](https://www.mongodb.com/docs/manual/tutorial/install-mongodb-on-os-x/)
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
