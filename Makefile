DEV  := docker compose -f docker-compose.dev.yml
PROD := docker compose -f docker-compose.prod.yml

.DEFAULT_GOAL := help

.PHONY: help \
	up down restart rebuild seed migrate studio logs worker-logs shell \
	prod-up prod-down prod-restart prod-rebuild prod-seed prod-migrate prod-logs prod-worker-logs prod-shell

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

## ---- Development (docker-compose.dev.yml) ----

up: ## Start the dev stack (detached)
	$(DEV) up -d

down: ## Stop the dev stack
	$(DEV) down

restart: down up ## Restart the dev stack

rebuild: ## Rebuild dev images from scratch (no cache)
	$(DEV) build --no-cache

seed: ## Seed the dev database
	$(DEV) exec app npx prisma db seed

migrate: ## Create + apply a dev migration (interactive)
	$(DEV) exec app npx prisma migrate dev

studio: ## Open Prisma Studio on :5555 (dev)
	$(DEV) exec app npx prisma studio --port 5555 --browser none

logs: ## Tail dev app logs
	$(DEV) logs -f app

worker-logs: ## Tail dev worker logs
	$(DEV) logs -f worker

shell: ## Shell into the dev app container
	$(DEV) exec app sh

## ---- Production (docker-compose.prod.yml) ----

prod-up: ## Start the prod stack (runs pending migrations on boot)
	$(PROD) up -d

prod-down: ## Stop the prod stack
	$(PROD) down

prod-restart: prod-down prod-up ## Restart the prod stack

prod-rebuild: ## Rebuild prod images from scratch (no cache)
	$(PROD) build --no-cache

prod-migrate: ## Apply pending migrations (prisma migrate deploy)
	$(PROD) run --rm migrate

prod-seed: ## Seed the prod database (compiled seed)
	$(PROD) exec app npm run seed:prod

prod-logs: ## Tail prod app logs
	$(PROD) logs -f app

prod-worker-logs: ## Tail prod worker logs
	$(PROD) logs -f worker

prod-shell: ## Shell into the prod app container
	$(PROD) exec app sh
