ADVISOR ATLAS — NATURAL LANGUAGE GRAPH EXPLORER

Open: http://127.0.0.1:8765

This local app queries the existing salesfoundation Neo4j database. It uses
your existing OpenAI key from the voice-form-demo project. The key stays in
its original .env.local file and is read only by the server; it is never sent
to the browser, included in source files, or copied into this deliverable.

START / RESTART
1. Keep the Sales Knowledge Graph instance running in Neo4j Desktop.
2. Run “Start App.ps1” from PowerShell. Keep that terminal running.
3. Open http://127.0.0.1:8765 in a browser.
4. Ctrl+C in the app terminal stops the app, without stopping Neo4j.

The launcher uses the installed Node 24 runtime with --use-system-ca so HTTPS
uses the Windows trusted certificate store. TLS verification remains on.
The current server is already running in the background. “Stop Background
App.ps1” stops this recorded process after checking its identity; it leaves
Neo4j running. Do not start a second copy on the same port. If the server is
already running, simply open the address above.

TRY THESE QUESTIONS
Six clickable capability cards sit beside the question composer on wide
screens and directly below it on smaller screens. Each runs a verified
Cypher template against live Neo4j, avoiding the model-planning wait.
Editing or typing a question still uses OpenAI to plan a read-only query.
• Show Alex’s holdings, assets, September sales, redemptions and net flows.
• Who are the three advisors most similar to Alex by fund allocation?
• Find articles about preparing family information for a first lawyer meeting.
• What articles should Elena review before meeting Alex, based on his request?
• Which of Elena’s advisors have net redemptions and repeated product page visits?
• Who else asked for the topic in the Active ETF models at Wells Fargo article?
• How many advisors does each salesperson cover?

READ THE ANSWER
Graph: drag, zoom, fit, rearrange, or save the displayed graph as a PNG.
Select a node or connection to inspect its attributes and financial amounts.
Stored graph is the default: every node and relationship comes directly from
Neo4j, including its elementId, labels/type, endpoints and returned properties.
The Neo4j properties inspector is part of the graph workspace. Click an element
or choose it in the inspector selector. Financial relationships show dollars
and their exact stored cents values. Expand Returned Neo4j record for JSON.
Optional Simplify paths combines advisor → book → share class → fund into an
advisor → fund connection for readability. Derived edges are explicitly marked
Display projection. Switch it off to see the stored graph. No database writes
are performed. The graph renderer places existing records on the canvas.
Results: inspect the exact rows used for the answer.
Cypher: inspect the executed query, its graph query and its parameters.
You can edit and run read-only Cypher. For vector searches, use the question
box so the server can generate the compatible query embedding.
Graph Summary Agent: runs automatically after natural-language AND manual
Cypher queries. The graph appears first while the agent reads its evidence.
The summary uses a real OpenAI Responses API stream, forwarded over SSE.
Its draft text appears as chunks arrive; cited findings replace the draft
when generation and reference validation finish. Provider/network buffering
can deliver several chunks together. A completed summary is cached briefly.
You can run another question while the summary writes. This stops the old
stream, and old results cannot overwrite the new graph or summary. Failed
or interrupted summaries leave the graph and result rows available.
The summary card explains the result; Findings & follow-ups adds cited facts,
labeled inferences and suggested next steps. These suggestions do not execute
actions. Click evidence links to inspect a row, node or relationship. An edge
hidden by Simplify paths opens the stored graph automatically.

HOW IT WORKS
Browser → local Node server → OpenAI Responses API → validated Cypher plan
→ Neo4j read-only query → immediate graph + result rows → Graph Summary Agent.

The dedicated summary agent uses the existing OpenAI Responses integration
with structured output. It receives sanitized query results AND the actual
nodes and relationships returned by Neo4j. It cannot query or modify the
database. It provides a short summary, findings, evidence references, proposed
follow-ups and result-specific limitations. Evidence IDs are checked against
the supplied output; unsupported references are rejected. Reference validation
does not prove every model-written statement is correct: inspect the evidence.

The browser requests /api/summarize using a server-generated result ID; the
endpoint does not trust a client-supplied graph. Up to 12 recent outputs are
held in server memory for 15 minutes. Completed summaries are cached for that
result. Empty results do not make an extra model call. If summarization fails,
an explicit Unavailable status appears and the query results remain usable.
Evidence is bounded before it is sent to the model, with partial coverage
disclosed. The main API also supports a combined query-and-summary response.

OpenAI model: gpt-4.1-mini, configurable with OPENAI_MODEL on server startup.
The API receives the question, schema, example queries, recent questions and
selected query results for the insight summary. Responses use store:false.
Requests consume the existing OpenAI project's API quota and credits.

The six sidebar capabilities have verified Cypher templates. OpenAI resolves
the intent and parameters; when it selects a template, the server compiles
that query. This keeps complex aggregation and similarity calculations
consistent. Custom plans generate Cypher from the real schema instead.
A failed plan gets one repair
attempt. Model-generated answers can still be wrong: the Results and Cypher
tabs expose the evidence and calculation so they can be reviewed.

Each question executes an answer query and, when useful, a corresponding
graph query. Ranked examples use the same cohort in both. Scalar-only answers
may legitimately have no graph. A bounded view is intentional; rendering an
entire enterprise database is not useful or feasible in one browser canvas.

SEMANTIC SEARCH
This is real embedding search, not a keyword simulation. Existing ContentChunk
vectors use all-MiniLM-L6-v2, 384 dimensions. embed.py embeds a new search with
the same local ONNX model and normalization. Neo4j's content_vectors cosine
index retrieves relevant passages. Current document versions are selected
and multiple passages are grouped into one result per document. The graph
can show the document/version/chunk evidence behind the result.

Article-to-article searches can use an existing article embedding through
custom Cypher. OpenAI embeddings are not mixed with the MiniLM index.
Similarity scores measure text relevance, not purchase probability.

WHERE THE ADVISOR DATA LIVES
Advisor nodes hold profile attributes. Employee COVERS_ADVISOR Advisor records
the salesperson. Advisor MEMBER_OF BuyingUnit links the advisor to a book.
BuyingUnit POSITION_AS_OF Instrument stores dated assets_cents and currency.
BuyingUnit FLOW_IN_PERIOD Instrument stores period-specific sales_cents,
redemptions_cents and net_flow_cents. Instrument OF_FUND Fund resolves the
share class to one canonical fund. Money is stored in integer cents.

VISITED_PAGE and RESEARCHED are dated aggregate relationships, avoiding a
new page node for every click. Each document has stable identity, versions
and embedded chunks. Interactions connect salespeople, advisors and notes.
Extracted Statement nodes link an explicit need to a Topic and supporting
note passage. A page view is evidence of interest, not proof of intent.

DATA SCOPE
20 synthetic advisors; 2 salespeople; 9 funds; 57 embedded passages.
Positions: September 29, 2026. Flows/activity: September 2026. Currency: USD.
Assets describe modeled Capital Group holdings, not the advisor's total AUM.
Public product information and screenshot-derived article summaries retain
their source context. Article approval is NOT_ESTABLISHED; recommendations
are candidates for review. Alex's liquidity note does not identify the exact
transaction responsible for a redemption.

CONTROLS AND LIMITS
The server binds to 127.0.0.1 only. API keys and database credentials remain
server-side. Neo4j uses a dedicated account scoped to reads on salesfoundation,
with permission for the vector-search procedure. Writes are rejected by Neo4j
itself as well as by the app's query filter. Cross-origin requests are blocked.
Queries are checked with EXPLAIN before execution. Outputs are bounded to
100 rows, 120 nodes and 240 connections; timeouts limit query requests.

This is a functioning local prototype, not a production deployment tested
for 200,000 advisors. Enterprise rollout requires authenticated users, tenant
and entitlement enforcement, managed secrets, query cost controls, audit logs,
evaluation datasets, monitoring and load tests. Keep warehouse event history
separate from the graph's useful aggregates; paginate neighborhood views.

LOCAL CONFIGURATION
Private connection settings live in ../../work/graph-app-connection.json.
GRAPH_APP_CONFIG can point to a different private configuration file.
OPENAI_API_KEY can override the configured key-file lookup when set securely
in the server environment. PORT can override the local port.
The local embedding runtime and model remain under ../../work. This source
folder therefore depends on this configured workspace and its running database.
Moving only this folder to another computer does not copy data, keys or models.

SOURCE AND VALIDATION
server.mjs — HTTP API, planning, Neo4j execution and summary coordination.
summary-agent.mjs — graph evidence preparation, summarization and citations.
templates.json — the six concrete Cypher capabilities.
demo-questions.json — the six visible questions and fixed template parameters.
public/stream.js — shared incremental SSE and summary text parsing.
schema.json / examples.json — real graph schema and query grounding.
guard.mjs — query validation and response sanitization.
embed.py — matching local semantic embedding runtime.
public/ — UI, graph projection and vendored Cytoscape.js.
tests/core.test.mjs — guard and graph-projection unit checks.
tests/integration.mjs — live OpenAI/Neo4j correctness and permission checks.
verification.json — saved live-test queries and their returned result rows.

Run unit checks: node --test tests/*.test.mjs
Run live checks: node --use-system-ca tests/integration.mjs
Additional live checks: node --use-system-ca tests/additional-live.mjs
Summary agent live checks: node --use-system-ca tests/summary-live.mjs
Summary verification: summary-verification.json
Streaming and six-demo checks: node --use-system-ca tests/stream-live.mjs
Streaming verification: streaming-verification.json
Neo4j provenance check: node --use-system-ca tests/graph-provenance-live.mjs
Graph verification: graph-provenance-verification.json (all six demos checked
against Neo4j by elementId, relationship endpoints and returned properties).
Live checks make OpenAI API calls and need the local app/database running.

OFFICIAL REFERENCES
https://developers.openai.com/api/docs/guides/streaming-responses
https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses
https://developers.openai.com/api/docs/models/gpt-4.1-mini
https://neo4j.com/docs/operations-manual/current/authentication-authorization/privileges-reads/
https://js.cytoscape.org/
