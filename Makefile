SHELL := /bin/bash
COMPOSE := docker compose -f docker-compose.dev.yml
.DEFAULT_GOAL := help

.PHONY: help build dev check _build _serve

##@ Development

build: ## Build the site in Docker into public/
	$(COMPOSE) run --rm --no-deps -T quartz make -f /site/Makefile _build

dev: ## Start the Docker preview
	$(COMPOSE) up

check: ## ShellCheck the embedded shell commands
	@set -o pipefail; $(MAKE) --no-print-directory -n _build | shellcheck -s bash -
	@set -o pipefail; $(MAKE) --no-print-directory -n _serve | shellcheck -s bash -
	@set -o pipefail; $(MAKE) --no-print-directory -n help | shellcheck -s bash -

##@ Help

help: ## Show available commands
	@awk 'BEGIN {FS = ":.*##"; section = ""} \
	/^[a-zA-Z0-9_.-]+:.*##/ { \
		if (section != "") printf "\n\033[1m%s\033[0m\n", section; \
		section = ""; \
		printf "  \033[36m%-11s\033[0m %s\n", $$1, $$2; next \
	} \
	/^##@/ { section = substr($$0, 5); next }' $(MAKEFILE_LIST)

_build _serve:
	@set -euo pipefail; \
	if [[ ! -f /site/quartz/package.json ]]; then \
		printf 'Quartz submodule is missing; run git submodule update --init\n' >&2; exit 1; \
	fi; \
	build_dir="$$(mktemp -d)"; \
	trap 'rm -rf "$$build_dir"' EXIT; \
	git -c safe.directory=/site/quartz -C /site/quartz archive HEAD | tar -xf - -C "$$build_dir"; \
	cp /site/quartz.config.yaml "$$build_dir/quartz.config.yaml"; \
	cp /site/styles/custom.scss "$$build_dir/quartz/styles/custom.scss"; \
	cd "$$build_dir"; \
	npm ci; \
	npx quartz build -d /site/content -o /site/public $(if $(filter _serve,$@),--serve --port 8000)
