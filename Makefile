NPM_BIN = $(shell npm bin)


all: build

build: build-tsc build-copy
build-tsc:
	$(NPM_BIN)/tsc
build-copy:
	node copy.js

dev:
	make dev-tsc dev-copy -j2
dev-tsc:
	$(NPM_BIN)/tsc --watch
dev-copy:
	node copy.js --watch

dist: build
	node dist.js

link-darwin-x64:
	ln -si $$(pwd)/dist/Pandown-darwin-x64/Pandown.app ~/Applications
