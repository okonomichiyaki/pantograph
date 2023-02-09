#!/bin/sh
poetry run gunicorn --bind :$PORT --workers 1 --threads 8 --timeout 0 -k geventwebsocket.gunicorn.workers.GeventWebSocketWorker pantograph.flask:app 
