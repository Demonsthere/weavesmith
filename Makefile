# WeaveSmith — convenience wrapper around the pnpm workspace.
# Everything here shells out to pnpm; nothing is Make-only, so you can always
# drop down to the underlying command if you need a flag this does not expose.

SHELL := /bin/bash
PNPM  := pnpm
WEB   := @weavesmith/web
CORE  := @weavesmith/core

.DEFAULT_GOAL := help
.PHONY: help install lint test check build core dev preview clean

help: ## Show this help
	@echo "WeaveSmith"
	@echo
	@grep -hE '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[1m%-9s\033[0m %s\n", $$1, $$2}'
	@echo

install: ## Install dependencies (also builds the engine, via prepare)
	@command -v $(PNPM) >/dev/null || { echo "pnpm not found — see https://pnpm.io/installation"; exit 1; }
	$(PNPM) install

# lint and test both depend on `core`: the app resolves @weavesmith/core to
# its dist, which is gitignored. Without this, a fresh clone or a `make clean`
# fails with "cannot find module @weavesmith/core" on code that is perfectly
# valid. Rebuilding is ~1s and incremental.

lint: core ## Typecheck every package
	@# No ESLint in this project yet — tsc under `strict` plus
	@# `noUncheckedIndexedAccess` is currently the whole static-analysis story.
	$(PNPM) typecheck

test: core ## Run the full test suite (engine + app)
	$(PNPM) test

check: lint test ## Typecheck and test — what CI runs

core: ## Build the engine only (the app resolves its types from dist/)
	$(PNPM) --filter $(CORE) build

build: ## Build everything, engine first
	$(PNPM) -r build

dev: core ## Start the app on a local dev server
	$(PNPM) --filter $(WEB) dev

preview: build ## Serve the production build locally
	$(PNPM) --filter $(WEB) preview

clean: ## Remove build output (keeps node_modules)
	rm -rf packages/core/dist apps/web/dist
	@echo "Removed build output. Run 'make core' or 'make install' before typechecking."
