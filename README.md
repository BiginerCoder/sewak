# Sewak

Sewak is a civic issue reporting frontend with a Govlinks government-service
recommendation API.

| Directory | Application | Local address |
| --- | --- | --- |
| `d-f/` | Next.js frontend and civic-issues database | http://localhost:3000 |
| `govlinks/` | Python API and government-link recommendation database | http://127.0.0.1:8080 |

The frontend calls Govlinks through a same-origin Next.js API proxy. The browser
does not need direct access to the Govlinks service.

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
