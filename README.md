# Sewak

Sewak is a civic issue reporting frontend with a Govlinks government-service
recommendation API.

| Directory | Application | Local address |
| --- | --- | --- |
| `d-f/` | Next.js frontend and civic-issues database | http://localhost:3000 |
| `govlinks/` | Python API and government-link recommendation database | http://127.0.0.1:8080 |

The frontend calls Govlinks through a same-origin Next.js API proxy. The browser
does not need direct access to the Govlinks service.

## Area service directory

Open **Area service links** from the navigation or home page to browse every
active government service link listed for an area. Type a supported ward,
locality, city, or district and choose a matching ward, or use **Use my
location**. Device coordinates are sent to OpenStreetMap Nominatim for a
one-time reverse lookup and are not stored by Sewak. GPS lookup can only resolve
to areas in the Govlinks demo data; without ward-boundary data, it may show links
for the local body or district rather than a precise ward. The interface labels
that coverage level and marks demo, candidate, or stale links.

The directory and its location picker require both the frontend and Govlinks API
to be running with demo mode enabled for link opening. It needs no sign-in;
demo visits use an anonymous local demo account. It only lists areas present in
the Govlinks database, currently a small synthetic sample, and is not a verified
national service directory.

## Sewak assistant chat

The Ask for help page streams answers from NVIDIA's OpenAI-compatible chat
endpoint. The server provides two controlled tools: semantic search over Sewak
cases using pgvector, and official-source web search using Tavily. The browser
never receives provider keys. Without `NVIDIA_API_KEY`, the assistant uses its
local objective/keyword matcher and labels the answer as a local match.

Configure private values in `d-f/.env`:

```dotenv
NVIDIA_API_KEY=<fresh key from NVIDIA>
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_MODEL=z-ai/glm-5.3
NVIDIA_EMBEDDING_MODEL=nvidia/nv-embedqa-e5-v5
TAVILY_API_KEY=<Tavily key>
ASSISTANT_INDEX_TOKEN=<long random secret>
```

Do not commit this file or expose keys through `NEXT_PUBLIC_` variables. A key
previously pasted into chat should be revoked and replaced before use.

## Resident accounts (Firebase Authentication)

The frontend supports optional email/password accounts while keeping civic
pages available to guests. Enable **Email/Password** in Firebase Authentication
and add the Firebase web-app values to `d-f/.env` using the
`NEXT_PUBLIC_FIREBASE_*` names in `d-f/.env.example`. Set `FIREBASE_PROJECT_ID`
and configure Firebase Admin credentials for the server, either with
Application Default Credentials (`GOOGLE_APPLICATION_CREDENTIALS`) or the
server-only `FIREBASE_SERVICE_ACCOUNT_JSON` variable. Never commit a service
account key or expose Admin credentials through `NEXT_PUBLIC_` variables.

Resident profile records (Firebase UID, email, and display name) are stored in
the PostgreSQL database configured by `DATABASE_URL`. Firebase verifies
resident credentials; the server verifies ID tokens, creates an HTTP-only
session cookie, and saves the profile. Sign-in supports a 14-day remembered
session or a browser-session cookie that expires after 12 hours. New reports,
comments, confirmations, evidence, authority updates, and resolution checks
are recorded persistently in `resident_activity` and associated with the
verified account email. Seeded/sample cases remain demo data.

Apply the additive profile and activity migrations to the configured app
database before enabling resident writes. For a database whose legacy
migration history is empty, do not replay the older baseline migrations; apply
only the reviewed additive SQL files:

```powershell
cd d-f
psql "$env:DATABASE_URL" --set ON_ERROR_STOP=on --file drizzle/0004_conscious_lightspeed.sql
psql "$env:DATABASE_URL" --set ON_ERROR_STOP=on --file drizzle/0005_persistent_resident_activity.sql
```

The frontend defaults to the light theme. An explicit saved dark-theme
preference continues to be respected.

### pgvector RAG setup

The app database needs the PostgreSQL `vector` extension. The stock `postgres:16`
image currently used by the local Docker container does not include pgvector.
Use a PostgreSQL 16 image with pgvector (for example,
`pgvector/pgvector:pg16`) and preserve the existing database volume. Back up
first and test restoring the backup to the pgvector image before changing the
active container; never delete a volume as part of this upgrade. Once the
extension is available, run the reviewed migration:

```powershell
cd d-f
npm run db:migrate
```

The migration creates an `assistant_documents` table with fixed 1024-dimension
vectors and an HNSW cosine index. `NVIDIA_EMBEDDING_MODEL` must return exactly
1024 dimensions. Index the current problem cases and category guidance through
the protected server endpoint after starting the app:

```powershell
$headers = @{ Authorization = "Bearer $env:ASSISTANT_INDEX_TOKEN" }
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/assistant/index -Headers $headers
```

The index endpoint only accepts the server-side `ASSISTANT_INDEX_TOKEN`;
re-run it after case descriptions or category guidance change. When pgvector is
not installed or the index has not been populated, the chat clearly reports
keyword retrieval instead of vector RAG.

### Official web search and boundaries

Tavily is called only as a server-side model tool. Search candidates and
returned URLs are checked against the allowlist in
`d-f/src/lib/assistant-server.ts` (Jaipur Municipal Corporation, Rajasthan
government portals, CPGRAMS, and NIC). Only HTTPS citations from those hosts
are returned. Web snippets are untrusted evidence, not instructions. The
assistant does not fetch arbitrary URLs, execute SQL from model output, or
submit complaints.

The chat sends the conversation and retrieved Sewak context to NVIDIA when
configured, and sends search terms to Tavily only when its web tool is used.
Conversation history is still browser-only and is not persisted. Verify advice
against cited official pages. This prototype still needs authentication,
authorization, rate limiting, privacy/retention review, and production
monitoring before public use.

> **Production status:** This repository is not ready to serve real users.
> Govlinks has no authentication and accepts client-supplied user IDs; the
> frontend uses demo resident data. Do not expose either app publicly with demo
> settings. Production use requires an authentication/authorization design,
> rate limiting, operational monitoring, database backups, and a review of
> privacy and data-retention requirements.

## Requirements

- Node.js 20.9 or newer and npm
- Python 3.10 or newer
- PostgreSQL 14 or newer
- Git

Docker can be used to run PostgreSQL locally. The frontend and Govlinks use
separate databases, even when those databases live on the same PostgreSQL
server.

## Configure local development

Create the databases `app_db` and `govlinks_demo` in your PostgreSQL server.
Use a local development account with appropriate access; do not use the
examples below as production credentials.

For the example ports in `.env.example`, create each database on its configured
PostgreSQL server (adjust the port/user to match your installation):

```powershell
psql -h localhost -p 5432 -U postgres -d postgres -c "CREATE DATABASE app_db"
psql -h localhost -p 5433 -U postgres -d postgres -c "CREATE DATABASE govlinks_demo"
```

Copy the example environment files:

```powershell
Copy-Item d-f\.env.example d-f\.env
Copy-Item govlinks\.env.example govlinks\.env
```

Edit both files for your local PostgreSQL host, port, username, and password.
Keep the real `.env` files private; they are ignored by Git.

Initialize the databases on a **new, empty development database**:

```powershell
cd govlinks
$env:GOVLINKS_DSN = "host=localhost port=5433 dbname=govlinks_demo user=postgres"
psql "$env:GOVLINKS_DSN" -v ON_ERROR_STOP=1 -f sql\01_schema.sql
psql "$env:GOVLINKS_DSN" -v ON_ERROR_STOP=1 -f sql\02_ranking.sql
psql "$env:GOVLINKS_DSN" -v ON_ERROR_STOP=1 -f sql\03_seed.sql
cd ..\d-f
npm install
npm run db:migrate
```

This repository does not yet include an npm lockfile. `npm install` resolves
versions within the ranges in `package.json`; generate and commit
`d-f/package-lock.json` before relying on reproducible shared or production
builds.

Set `GOVLINKS_DSN` to the same host, port, user, and database as in
`govlinks/.env`. If password authentication is enabled, use your local
PostgreSQL credential helper; do not put a real password in a command or a
checked-in file.

Install the backend dependencies in a virtual environment:

```powershell
cd ..\govlinks
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

## Run the applications

On Windows, run `run-sewak.bat` from the repository root to start the frontend
and, when its local environment and virtual environment are present, the
Govlinks API in separate terminal windows. It opens the frontend at
http://127.0.0.1:3000. It reuses a frontend on port 3000 if its login page
responds, or tries port 3001 when port 3000 is occupied by an unresponsive
service; it reports an error if both ports are occupied and unresponsive.
PostgreSQL must already be running with the configured databases; the launcher
does not create databases, apply migrations, or start a PostgreSQL service.

Start the Govlinks API in one terminal:

```powershell
cd govlinks
.\.venv\Scripts\Activate.ps1
python api.py
```

Start the frontend in another terminal:

```powershell
cd d-f
npm run dev
```

The backend reads `govlinks/.env`; the frontend reads `d-f/.env`. For normal
local development, keep `GOVLINKS_HOST=127.0.0.1` and
`GOVLINKS_ALLOW_DEMO=1`. Demo mode is only for local development and must not
be exposed to the public internet.

## Verify

```powershell
Invoke-RestMethod http://127.0.0.1:8080/api/health
Invoke-RestMethod http://localhost:3000/api/health
Invoke-RestMethod http://localhost:3000/api/govlinks/health
npm --prefix d-f run lint
npm --prefix d-f run typecheck
npm --prefix d-f run build
```

Govlinks endpoint tests use the demo database and start a local mock website:

```powershell
cd govlinks
python test_api.py
```

**Do not run `python demo.py` against a database you need to keep.** It drops
and recreates the `govlinks_demo` database as part of its end-to-end demo.

## Database migrations

For a schema change, update `d-f/src/db/schema.ts`, generate a migration, inspect
it, then apply it to the intended database:

```powershell
cd d-f
npm run db:generate
npm run db:migrate
```

Do not use schema-push or demo-seed commands as a substitute for reviewing
migrations on a production database. Back up the database before applying
production migrations.

## Deployment notes

- Set `DATABASE_URL` and `GOVLINKS_API_URL` in the frontend hosting environment.
- Set `GOVLINKS_DSN`, `GOVLINKS_HOST`, and `GOVLINKS_ALLOW_DEMO=0` in the API
  hosting environment. Bind to `0.0.0.0` only behind an appropriately secured
  deployment ingress.
- Use private networking and TLS at the ingress between services where
  supported. Never commit live credentials or real resident data.
- Do not deploy the API publicly until authentication is implemented and
  identity is derived from a verified session rather than request data.
- Replace all demo content and review upload storage, privacy, backup/restore,
  logging, and incident-response requirements before launch.

See [govlinks/README.md](govlinks/README.md) for recommendation-engine and
API details.
