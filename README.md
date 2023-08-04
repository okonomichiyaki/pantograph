# pantograph

play paper netrunner via webcam

see the demo live [here](https://pantograph.cbgpnck.net/app/demo/)

## running locally

dependencies:

- install python and poetry
- [install and start MongoDB](https://www.mongodb.com/docs/manual/tutorial/install-mongodb-on-os-x/)
- get an API key from [Metered](https://www.metered.ca/)
- get an API key from [Google Vision](https://cloud.google.com/vision/)

build: `poetry install`

run: `export METERED_API_KEY=<metered>; export VISION_API_KEY=<google>; poetry run gunicorn -k geventwebsocket.gunicorn.workers.GeventWebSocketWorker -w 1 pantograph.flask:app`
