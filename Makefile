.DEFAULT_GOAL := dev
.PHONY: dev stop db setup samples worker

# Local PostgreSQL + pgvector with the fictional training fixture. Preserve data.
dev:
	node tools/dev/database.mjs start
	node tools/dev/run.mjs portal

stop:
	node tools/dev/database.mjs stop

db:
	node tools/dev/database.mjs start

setup:
	node tools/dev/database.mjs setup
	node tools/dev/run.mjs migrate
	node tools/dev/database.mjs grant
	python3 tools/dev/build-manuals.py
	node tools/dev/run.mjs seed

samples:
	node tools/dev/run.mjs samples

worker:
	node tools/dev/run.mjs worker
