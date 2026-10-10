# Sewak

Sewak is a civic-issues frontend demo for Ward 24, Shastri Nagar, Jaipur. It
uses sample data and saves demo interactions (reports, comments, confirmations,
and photos) in the current browser only. It does not require a database, API
server, API keys, or environment variables, and it does not send reports to
government services.

## Deploy the frontend to Vercel

1. Push the `demo` branch to GitHub.
2. Import the repository in Vercel and select `demo` as the production branch.
3. Set the project root directory to `d-f`.
4. Keep the detected Next.js framework and default build settings, then deploy.

No environment variables or separate backend services are required.

## Run locally

Requirements: Node.js 20.9 or newer and npm.

```powershell
cd d-f
npm install
npm run dev
```

Open http://localhost:3000. Use `npm run lint`, `npm run typecheck`, and
`npm run build` from `d-f` to validate the frontend.

## Demo data and privacy

The built-in sample data is simulated. Changes are stored in local browser
storage and are not shared with other devices or visitors. Clearing this
browser's site data resets the demo. Do not enter real resident or sensitive
information.

The `govlinks/` directory contains a separate API/database project retained
for development; the frontend and its Vercel deployment do not use it.
