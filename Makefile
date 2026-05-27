.PHONY: help dev demo stop down seed ingest bootstrap bootstrap-once wait-neo4j reset logs ps fe-install fe-dev fe-build fe-typecheck fe-lint test test-unit test-integration test-e2e

NEO4J_URI ?= bolt://localhost:7687
NEO4J_USER ?= neo4j
NEO4J_PASSWORD ?= infrawatch
export NEO4J_URI NEO4J_USER NEO4J_PASSWORD

help:
	@echo "Targets:"
	@echo "  dev              Start backend stack (no frontend container) + pnpm dev on host"
	@echo "  demo             Start full stack including frontend container (profile=demo)"
	@echo "  stop             docker compose stop"
	@echo "  down             docker compose down (keeps volumes)"
	@echo "  reset            docker compose down -v (wipes volumes)"
	@echo "  seed             Seed Neo4j topology"
	@echo "  ingest           Ingest runbooks + incidents into Neo4j"
	@echo "  bootstrap        seed + ingest (one-time after first 'make dev')"
	@echo "  logs             Tail compose logs"
	@echo "  ps               docker compose ps"
	@echo "  fe-install       pnpm install in frontend"
	@echo "  fe-dev           pnpm dev in frontend"
	@echo "  fe-build         pnpm build in frontend"
	@echo "  fe-typecheck     pnpm typecheck in frontend"
	@echo "  fe-lint          pnpm lint in frontend"
	@echo "  test             Run all pytest"
	@echo "  test-unit        pytest tests/unit"
	@echo "  test-integration pytest tests/integration"
	@echo "  test-e2e         pytest tests/e2e"

dev:
	docker compose up -d
	$(MAKE) wait-neo4j
	$(MAKE) bootstrap-once
	@echo ">> backend stack up. starting frontend on http://localhost:3001"
	cd frontend && pnpm dev

wait-neo4j:
	@echo ">> waiting for neo4j on $(NEO4J_URI)..."
	@for i in $$(seq 1 60); do \
	  if python3 -c "import os; from neo4j import GraphDatabase; GraphDatabase.driver(os.environ['NEO4J_URI'], auth=(os.environ['NEO4J_USER'], os.environ['NEO4J_PASSWORD'])).verify_connectivity()" 2>/dev/null; then \
	    echo ">> neo4j ready"; exit 0; \
	  fi; \
	  sleep 2; \
	done; \
	echo ">> neo4j failed to start within 120s"; exit 1

bootstrap-once:
	@count=$$(python3 -c "import os; from neo4j import GraphDatabase; d=GraphDatabase.driver(os.environ['NEO4J_URI'], auth=(os.environ['NEO4J_USER'], os.environ['NEO4J_PASSWORD'])); s=d.session(); print(s.run('MATCH (r:Runbook) RETURN count(r) AS c').single()['c']); d.close()" 2>/dev/null || echo 0); \
	if [ "$$count" = "0" ]; then \
	  echo ">> empty graph, seeding + ingesting"; \
	  $(MAKE) seed; \
	  $(MAKE) ingest; \
	else \
	  echo ">> graph already has $$count runbooks, skipping bootstrap"; \
	fi

demo:
	docker compose --profile demo up -d --build
	@echo ">> full stack up. frontend at http://localhost:3001"

stop:
	docker compose --profile demo stop

down:
	docker compose --profile demo down

reset:
	docker compose --profile demo down -v

seed:
	python3 graph/seed.py

ingest:
	python3 graph/ingest.py

bootstrap: seed ingest

logs:
	docker compose --profile demo logs -f --tail=100

ps:
	docker compose --profile demo ps

fe-install:
	cd frontend && pnpm install

fe-dev:
	cd frontend && pnpm dev

fe-build:
	cd frontend && pnpm build

fe-typecheck:
	cd frontend && pnpm typecheck

fe-lint:
	cd frontend && pnpm lint

test:
	pytest

test-unit:
	pytest tests/unit/

test-integration:
	pytest tests/integration/

test-e2e:
	pytest tests/e2e/
