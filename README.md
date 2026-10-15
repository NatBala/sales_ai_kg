# sales_ai_kg

Advisor Atlas is a local sales knowledge graph explorer. Ask a natural-language question, inspect the generated read-only Cypher, see actual Neo4j nodes and relationships, and receive a streaming explanation with evidence references.

This repository contains the restored Graph Explorer version. The subsequently reverted Shared AI Foundation implementation is not included.

## Capabilities

- Advisor holdings, sales, redemptions and net flows, with exact financial properties.
- Similar advisors ranked by fund allocation overlap.
- Local MiniLM semantic search over an existing Neo4j vector index.
- Content review candidates linked to explicit advisor needs and source notes.
- Follow-up signals and article audience discovery.
- Six verified example queries, editable Cypher, raw node/relationship inspection and optional simplified display.
- Graph results appear before the separate streaming summary agent finishes.

## Requirements and configuration

- Node.js 24 or newer; no npm dependencies are needed for the server or unit tests. Cytoscape.js is vendored with its license in `public/vendor/`.
- An existing Neo4j `salesfoundation` database matching `schema.json`, with an account limited to read access and the required vector-search procedure. The database and its credentials are not included.
- An OpenAI API key provided through the server environment (`OPENAI_API_KEY`) or a private env file selected by `openaiKeyFile`. Never put a key in browser code.
- For semantic queries: a Python environment with NumPy, ONNX Runtime and Hugging Face Tokenizers, plus the compatible all-MiniLM-L6-v2 ONNX model and tokenizer. The existing index uses normalized 384-dimensional vectors.

Copy `graph-app-connection.example.json` to a private `graph-app-connection.json`, edit the placeholders, and set `GRAPH_APP_CONFIG` to its absolute path. The private filename is ignored by Git. When `OPENAI_API_KEY` is set, the server does not need to read `openaiKeyFile`.

Example PowerShell startup after configuring the private file:

```powershell
$env:GRAPH_APP_CONFIG = (Resolve-Path ./graph-app-connection.json).Path
npm start
```

The app listens at `http://127.0.0.1:8765/` with the example configuration. `PORT` and `OPENAI_MODEL` override the configured port and model. The start command uses `--use-system-ca`; TLS verification remains enabled.

## Existing workspace layout

This is the source snapshot of a working local prototype, not a one-command database installation. `embed.py`, the existing PowerShell launchers and live tests retain the original workspace conventions:

```text
workspace/
  work/
    graph-app-connection.json       # private, not versioned
    embedding-deps/                # Python modules, optional if installed in Python
    embedding-model/
      model.onnx
      tokenizer.json
  outputs/
    sales_ai_kg/                    # this repository
```

`GRAPH_APP_CONFIG` can relocate the server configuration. `embed.py` still resolves model files relative to the layout above. Use `npm start` for a portable Node launch; `Start App.ps1` retains this workstation's runtime path. Live tests expect `../../work/graph-app-connection.json` and a running, seeded database. Downloaded models, raw screenshots, database exports, logs and private configuration are intentionally excluded from Git.

## Tests

```sh
npm test
```

The 32 local tests cover Cypher restrictions, result sanitization, graph projection, streaming parsing and summary evidence handling. They require neither credentials nor a running database.

Live checks require the configured database and running server and can incur OpenAI API usage:

```sh
node --use-system-ca tests/integration.mjs
node --use-system-ca tests/summary-live.mjs
node --use-system-ca tests/stream-live.mjs
node --use-system-ca tests/graph-provenance-live.mjs
```

Generated verification reports are excluded from version control. See `README.txt` for the detailed existing application behavior, sample questions and local operating instructions.

## Scope

The configured demo has 20 synthetic advisors, two salespeople, nine funds and 57 embedded passages. Positions are dated September 29, 2026; flows and activity cover September 2026. Financial amounts describe modeled Capital Group holdings, not total advisor AUM. Page visits and similarity are not trade commitments; content recommendations require review.

This application binds to loopback and is an analyst prototype. Production deployment needs authenticated users, entitlement enforcement, managed secrets, query cost controls, operational monitoring and scale testing. Citation validation checks that references exist; it does not establish that every generated interpretation is correct.
