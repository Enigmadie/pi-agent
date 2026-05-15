.PHONY: install dev build start typecheck check db-generate db-migrate clean

install:
	npm install

dev:
	npm run dev

build:
	npm run build

start:
	npm start

typecheck:
	npm run typecheck

check: typecheck build

db-generate:
	npm run db:generate

db-migrate:
	npm run db:migrate

clean:
	rm -rf dist
