SHELL := /bin/bash
COMPOSE := docker compose -f docker-compose.dev.yml
.DEFAULT_GOAL := help
OUTPUT := /site/public
NOTE_DATE := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))note-date.ts
_serve: OUTPUT := /site/.quartz-dev-public

.PHONY: help build dev check note _build _serve

##@ Development

build: ## Build the site in Docker into public/
	$(COMPOSE) run --rm --no-deps -T quartz make -f /site/Makefile _build

dev: ## Start the Docker preview
	$(COMPOSE) up

check: ## Check the embedded shell commands and note creation
	@set -o pipefail; $(MAKE) --no-print-directory -n _build | shellcheck -s bash -
	@set -o pipefail; $(MAKE) --no-print-directory -n _serve | shellcheck -s bash -
	@set -o pipefail; $(MAKE) --no-print-directory -n help | shellcheck -s bash -
	@set -o pipefail; $(MAKE) --no-print-directory -n note | shellcheck -s bash -
	@node --test "$(dir $(NOTE_DATE))note-date.test.ts"
	@set -euo pipefail; \
	tmpdir="$$(mktemp -d)"; trap 'rm -rf "$$tmpdir"' EXIT; mkdir "$$tmpdir/content"; \
	printf 'test-note\n' | EDITOR=true $(MAKE) --no-print-directory -s -C "$$tmpdir" -f "$(CURDIR)/Makefile" note; \
	file="$$tmpdir/content/$$(date +%F)-test-note.md"; \
	test -f "$$file"; \
	if printf 'test-note\n' | EDITOR=true $(MAKE) --no-print-directory -s -C "$$tmpdir" -f "$(CURDIR)/Makefile" note >/dev/null 2>&1; then \
		printf 'duplicate note was overwritten\n' >&2; exit 1; \
	fi; \
	if printf '../invalid\n' | EDITOR=true $(MAKE) --no-print-directory -s -C "$$tmpdir" -f "$(CURDIR)/Makefile" note >/dev/null 2>&1; then \
		printf 'invalid slug was accepted\n' >&2; exit 1; \
	fi; \
	diff -u <(printf '%s\n' '---' 'title: test-note' 'description: ""' "date: $$(date +%F)" "created: $$(date +%F)" 'tags: []' '---' '') "$$file"; \
	i=0; \
	for spec in '2026-01-03|2026-01-03|2026-01-03' '2026-01|2026-01-00|"2026-01"' '2026-01-dd|2026-01-00|"2026-01"' '2026-mm-dd|2026-00-00|"2026"' '2026|2026-00-00|"2026"' '|0000-00-00|""'; do \
		IFS='|' read -r input normalized frontdate <<< "$$spec"; \
		((i+=1)); slug="backfill-$$i"; \
		printf '%s\n' "$$slug" | EDITOR=true $(MAKE) --no-print-directory -s -C "$$tmpdir" -f "$(CURDIR)/Makefile" note DATE="$$input"; \
		diff -u <(printf '%s\n' '---' "title: $$slug" 'description: ""' "date: $$frontdate" "created: $$frontdate" 'tags: []' '---' '') "$$tmpdir/content/$$normalized-$$slug.md"; \
	done; \
	if printf 'invalid-date\n' | EDITOR=true $(MAKE) --no-print-directory -s -C "$$tmpdir" -f "$(CURDIR)/Makefile" note DATE=2026-02-29 >/dev/null 2>&1; then \
		printf 'invalid DATE was accepted\n' >&2; exit 1; \
	fi

note: ## Create a note (DATE=YYYY-MM-DD, YYYY-MM, YYYY or empty)
	@set -euC; \
	if [[ -t 0 ]]; then exec </dev/tty >/dev/tty 2>&1; fi; \
	read -r -p 'slug: ' slug; \
	if [[ ! "$$slug" =~ ^[a-z0-9]+(-[a-z0-9]+)*$$ ]]; then \
		printf 'slug must use lowercase letters, digits and hyphens\n' >&2; exit 1; \
	fi; \
	date="$$(node "$(NOTE_DATE)" "$${DATE-$$(date +%F)}")"; \
	file="content/$$date-$$slug.md"; \
	frontdate="$$date"; \
	if [[ "$$date" == *-00-00 ]]; then frontdate="$${date:0:4}"; fi; \
	if [[ "$$date" == *-00 && "$$frontdate" == "$$date" ]]; then frontdate="$${date:0:7}"; fi; \
	if [[ "$$frontdate" == 0000 ]]; then frontdate=''; fi; \
	if [[ "$$frontdate" != "$$date" ]]; then frontdate="\"$$frontdate\""; fi; \
	printf '%s\n' '---' "title: $$slug" 'description: ""' "date: $$frontdate" "created: $$frontdate" 'tags: []' '---' '' > "$$file"; \
	"$${EDITOR:-vi}" "$$file"

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
	cp /site/quartz.ts "$$build_dir/quartz.ts"; \
	cp /site/note-date.ts "$$build_dir/note-date.ts"; \
	cp /site/styles/custom.scss "$$build_dir/quartz/styles/custom.scss"; \
	cd "$$build_dir"; \
	npm ci; \
	target="$@"; \
	if [[ "$$target" == "_serve" ]]; then \
		node -e 'const fs = require("node:fs"); const [src, dest] = process.argv.slice(1); fs.watchFile(src, { interval: 500 }, (now, prev) => { if (now.mtimeMs !== prev.mtimeMs) fs.copyFileSync(src, dest) })' /site/styles/custom.scss "$$build_dir/quartz/styles/custom.scss" & \
		watcher_pid=$$!; \
		trap 'kill "$$watcher_pid" 2>/dev/null || :; rm -rf "$$build_dir"' EXIT; \
	fi; \
	npx quartz build -d /site/content -o "$(OUTPUT)" $(if $(filter _serve,$@),--serve --port 8000)
