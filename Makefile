.PHONY: run build install

run: node_modules/.package-lock.json
	npm run dev

build: node_modules/.package-lock.json
	npm run build

install:
	npm install

node_modules/.package-lock.json: package.json package-lock.json
	npm install
