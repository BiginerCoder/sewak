# Sewak quick start (Windows + Docker)

This project has two applications:

- `govlinks` — Python API and PostgreSQL-backed recommendation engine
- `civic-frontend` — Vite/React frontend

The `d-f` Next.js app also connects to the Govlinks API from its Ask for help page. Set `GOVLINKS_API_URL` in
`d-f\.env.local` to the backend origin (for local development, `http://127.0.0.1:8080`) before starting Next.js.
The app proxies API requests server-side, so the backend does not need browser CORS configuration. Keep the Govlinks
API private: its demo endpoints accept client-supplied user IDs and are not suitable for public production use.

The database runs in Docker as `govlinks-postgres`, published on **localhost:5433**.

## First-time setup

1. Start Docker Desktop and wait for **Engine running**.

2. In PowerShell, start the database container:

   ```powershell
   cd C:\Users\rahul\Documents\sewak
   docker start govlinks-postgres
   docker ps
   ```

   Confirm that `govlinks-postgres` is running and shows a mapping like
   `0.0.0.0:5433->5432/tcp`.

3. Install frontend packages once:

   ```powershell
   cd .\civic-frontend
   npm install
   ```

4. Seed the demo database once. This **drops and rebuilds** `govlinks_demo` with the sample locations, links,
   users, rankings, and simulated activity:

   ```powershell
   cd C:\Users\rahul\Documents\sewak\govlinks
   $env:Path += ";C:\Program Files\PostgreSQL\17\bin"
   $env:PGHOST = "localhost"
   $env:PGPORT = "5433"
   $env:PGUSER = "postgres"
   $env:GOVLINKS_DSN = "host=localhost port=5433 user=postgres dbname=govlinks_demo"
   python demo.py
   ```

   The expected final line is `48/48 checks passed`.

## Start the app

Use two PowerShell windows and leave both commands running.

### Terminal 1 — backend API

```powershell
cd C:\Users\rahul\Documents\sewak\govlinks
$env:GOVLINKS_ALLOW_DEMO = "1"
$env:GOVLINKS_DSN = "host=localhost port=5433 user=postgres dbname=govlinks_demo"
.\.venv\Scripts\python.exe api.py
```

The API is available at http://127.0.0.1:8080. Demo mode enables temporary demo users and placeholder links used by
the frontend.

### Terminal 2 — frontend

```powershell
cd C:\Users\rahul\Documents\sewak\civic-frontend
npm run dev
```

Open http://127.0.0.1:5173. Vite forwards `/api` requests from the frontend to the API on port 8080.

## Every later run

1. Start Docker Desktop.
2. Run `docker start govlinks-postgres` from `C:\Users\rahul\Documents\sewak`.
3. Start the backend using the Terminal 1 commands above.
4. Start the frontend using the Terminal 2 commands above.

You only need to run `python demo.py` again when you deliberately want to reset the demo data.

## PostgreSQL password

The Docker `postgres` role has password authentication configured as `rahul@1111`. If a command asks for a password,
enter it, or create `%APPDATA%\postgresql\pgpass.conf` with this one line so PostgreSQL tools can authenticate without
prompting:

```text
localhost:5433:*:postgres:rahul@1111
```

Keep this file private. Do not commit it to Git.

## Quick checks

```powershell
# Database container
docker ps

# API health (with the backend running)
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8080/api/health

# Frontend proxy (with both services running)
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:5173/api/wards
```

If the frontend shows a `500` error or no wards, stop the API with `Ctrl+C` and start it again using the Terminal 1
commands. That ensures it receives `GOVLINKS_DSN` rather than the project's original Linux `/tmp` database default.
