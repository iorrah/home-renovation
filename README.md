# Home Renovation Project Tracker

A full-stack monorepo where contractors and homeowners collaborate on renovation jobs: a NestJS GraphQL API, a background report worker, and a Next.js web app, backed by PostgreSQL and Redis.

## Features

- Jobs and their homeowners
- A chat per job, with real-time messages
- A full change history with undo and redo
- PDF reports built in the background

**Stack:** Node 24, TypeScript, NestJS 12, GraphQL (Apollo, code-first), PostgreSQL 18 with
TypeORM 1, Redis 8 with BullMQ, Next.js 16 with TanStack Query, Tailwind and shadcn/ui.

## Run it

You need Node 24.15+ (`nvm use`), pnpm 12.9 (`corepack enable`) and Docker.

```bash
pnpm install
cp api/.env.example api/.env
cp app/.env.example app/.env.local
pnpm infra:up                     # Postgres, test Postgres and Redis in Docker
pnpm --filter api migration:run
pnpm --filter api seed            # demo users, jobs, history and 5,000 messages
```

Then, in three terminals (start the API first: it compiles the code the worker runs):

```bash
pnpm dev:api      # GraphQL API and GraphiQL on http://localhost:4000/graphql
pnpm dev:worker   # builds PDF reports in the background
pnpm dev:app      # web app on http://localhost:3000
```

### Demo accounts

Every password is `password123`. `pnpm --filter api seed` resets the database to this state at any time.

| Username | Role       | Jobs                                                                |
| -------- | ---------- | ------------------------------------------------------------------- |
| `carlos` | Contractor | Kitchen remodel, Basement finish (large: 300 edits, 5,000 messages) |
| `diana`  | Contractor | Primary bathroom (left with an undone edit, so redo is available)   |
| `hannah` | Homeowner  | Kitchen, Basement                                                   |
| `henry`  | Homeowner  | Kitchen                                                             |
| `hugo`   | Homeowner  | Bathroom                                                            |

## Architecture

```mermaid
flowchart LR
  browser[Browser: Next.js app] -- GraphQL over HTTP --> api[NestJS API]
  browser -- GraphQL subscriptions over WebSocket --> api
  browser -- GET /reports/:id/file --> api
  api --> pg[(PostgreSQL)]
  api -- add report task / publish message --> redis[(Redis)]
  redis -- report tasks --> worker[Report worker]
  redis -- new messages --> api
  worker --> pg
  worker -- writes PDF --> files[(Reports folder)]
  api -- streams PDF --> files
```

- **API** (`api/src/main.ts`): GraphQL for everything, plus one REST route to download PDFs,
  because binary files do not fit GraphQL's JSON responses.
- **Worker** (`api/src/worker.ts`): a separate process that takes report tasks off the BullMQ
  queue, so the API never spends time building PDFs.
- **Redis** carries the report queue and the pub/sub for live messages. Because pub/sub goes
  through Redis rather than process memory, a message sent through one API instance reaches
  subscribers on every instance (an e2e test runs two instances to prove it).

## Using the API

Open GraphiQL at http://localhost:4000/graphql, or log in with curl:

```bash
curl -s http://localhost:4000/graphql -H 'Content-Type: application/json' \
  -d '{"query":"mutation { login(input: {username: \"carlos\", password: \"password123\"}) { accessToken } }"}'
```

Send the token as `Authorization: Bearer <token>` on every other request (in GraphiQL, under
Headers). For subscriptions, send `{ "authorization": "Bearer <token>" }` in the WebSocket
`connectionParams`.

| Operation                                      | Who        | What it does                                                        |
| ---------------------------------------------- | ---------- | ------------------------------------------------------------------- |
| `jobs`, `job(id)`                              | both roles | Contractors see their jobs; homeowners see the jobs they are on     |
| `createJob`, `updateJob`, `deleteJob`          | contractor | `updateJob` takes `expectedVersion`; deleting is a soft delete      |
| `addHomeowner`, `removeHomeowner`              | contractor | Manage who can see a job                                            |
| `jobHistory(jobId)`                            | both roles | Every change, oldest first, with who made it and a readable summary |
| `undoJobChange`, `redoJobChange`               | contractor | Also take `expectedVersion`                                         |
| `messages(jobId, after, limit)`, `sendMessage` | both roles | `after` fetches only newer messages, for catching up                |
| `messageAdded(jobId)` (subscription)           | both roles | New messages as they are sent                                       |
| `requestReport(jobId)`, `reportExport(id)`     | contractor | Starts a PDF in the background; poll until `DONE`                   |
| `GET /reports/:exportId/file`                  | contractor | Downloads the finished PDF                                          |

Errors carry a stable `extensions.code`: `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`,
`BAD_REQUEST` (with field `details`), or `CONFLICT`.

## Key decisions

- **History as a change log with undo states.** `jobs` holds the current state; `job_changes`
  is an append-only log, numbered per job, that stores only the changed fields as
  `{ from, to }`. Undo writes back `from`, redo writes `to`. Each edit is `APPLIED`, `UNDONE` or
  `DISCARDED` (undone, then replaced by a new edit), like an editor's undo stack. Nothing is
  deleted, so the log doubles as an audit trail. Full event sourcing would complicate every read
  for four fields, and snapshots read less naturally than diffs.
- **Data integrity.** Each change runs in one transaction with the job row locked, so the
  change and its history entry are saved together or not at all. `expectedVersion` rejects edits
  and undos made from a stale view, and undo refuses if the job no longer matches its history.
  The database enforces unique change numbers per job, the history rules, and non-negative costs.
- **Asynchronous report export.** The API saves the request and queues a task; the worker
  builds the PDF, reading rows in pages so memory stays flat on large jobs. Postgres and Redis
  cannot share a transaction, so the task id is the export id (re-adding is harmless), a failed
  enqueue marks the export `FAILED`, and the worker re-queues exports stuck in `QUEUED` on
  startup. A partial unique index allows one active export per job, so repeated clicks return
  the same export.
- **Money is integer cents**, never floats.
- **"Not found" instead of "forbidden"** for jobs you cannot access, so ids reveal nothing.

## Web app

Contractors can log in, manage jobs and homeowners, browse history with undo and redo, chat in
real time, and export PDFs. Homeowners get a read-only view plus the chat.

- The access token lives in `localStorage`: simple, and it works for both HTTP and the
  WebSocket. The trade-off is exposure to cross-site scripting; an httpOnly cookie would need
  every request, including the WebSocket, to go through a proxy.
- Forms use React Hook Form with Zod. Costs are typed in dollars and sent as cents.
- The chat shows the latest 50 messages and catches up with `after` when the WebSocket reconnects.

## Tests

```bash
pnpm --filter api test        # unit tests
pnpm --filter api test:e2e    # e2e tests against the test Postgres and Redis (needs pnpm infra:up)
```

The e2e suite covers role-based access, undo and redo (including concurrent changes, stale
versions and changes made outside the log), real-time delivery across two API instances, and a
full report export through the real worker. CI runs lint, formatting, typechecks, both test
suites, a check that entities match the migrations, and a web app build.

## Scope and limitations

- Users are seeded: no sign-up, password reset or refresh tokens. Tokens last an hour.
- Undo and redo only cover job fields (description, address, status, cost).
- Adding or removing homeowners is recorded in the history but cannot be undone.
- Report files are kept on local disk. In production they would go to object storage (such as
  AWS S3) with short-lived download links.
- A homeowner removed from a job keeps receiving its live messages until they reconnect.

## With more time

- A `reportReady` subscription instead of polling, and clean-up of old report files.
- Batching per-job field lookups with DataLoader, and cursor paging backwards for messages.
- Docker images for the API, worker and web app, for a one-command start.

## How I used AI

- **Research:** I used it to explore the problem space and the technology options.
- **Planning:** I used it to criticize / find gaps in my plan and to break large features into small tasks.
- **Review:** I used it to challenge my technical decisions.
- **Writing:** I used it to produce boilerplate, tests, PR descriptions and documentation.

## What I decided myself

- **Scope:** I cut features that would add delivery time, and went beyond the brief where it paid off, such as building a monorepo with backend and frontend.
- **Stack:** I chose it from my own experience and industry knowledge, and rejected AI suggestions that relied on outdated training data.
- **Simplicity:** I rejected over-engineered AI proposals for simple features and deliberately traded scalability for the scope of this project.
- **Models:** I matched the model to the task: stronger/slower models where a mistake was expensive,
  and faster/cheaper where the work is high-volume or easy to check.

## How I use AI models

- **Research:** Perplexity for discovery, because every answer is cited and I can open
  the sources. Claude Sonnet 5.5 to synthesize and critique what I found.
- **Architecture and product decisions:** Claude Opus 5.5, because these choices are
  the hardest to reverse. I use it to challenge my plans and find gaps, but I make the
  final call.
- **Coding:** Claude Sonnet 5.5, for the best balance of quality and cost. All output
  goes through my review, typechecks, lint and tests.
- **Documentation and small tasks:** GPT 6, because the output is easy to
  verify and the volume is high.
