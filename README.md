# MediStock

MediStock is a static HTML/CSS/JavaScript inventory UI with a Java 17 HTTP API and TiDB Cloud (MySQL-compatible) storage. The intended deployment is **Vercel for the frontend** and **Render for the backend**.

> **Credential safety:** the screenshots shared with this project show a TiDB connection password and username. Rotate/regenerate that TiDB password now, and do not commit or send the replacement password. Set it directly in Render's environment-variable UI.

## Project layout

- `frontend/` — login, registration, dashboard, and browser-side API client
- `backend/src/MediStockServer.java` — Java API
- `backend/pom.xml` — Maven build and MySQL Connector/J dependency
- `backend/Dockerfile` — Render container build
- `database/medistock.sql` — database schema and sample medicines
- `render.yaml` — Render service blueprint
- `build.mjs`, `vercel.json` — Vercel static-site build

## 1. Prepare TiDB Cloud

1. Create/activate a TiDB Cloud cluster and use its **Public Endpoint** connection details.
2. In TiDB SQL Editor, execute all of `database/medistock.sql`. This creates `medistock`, `users`, and `medicines` and inserts sample rows.
3. In the cluster's IP access list, allow the Render service's outbound IP addresses (shown in the Render service dashboard). The current workstation's IP allow rule does not automatically allow Render.
4. Keep the host, username, and rotated password private. The host value is only the hostname—do not include `https://`.

The Java JDBC connection enables TLS certificate and hostname verification. Do not disable TLS verification to work around certificate or connectivity errors.

## 2. Deploy the backend to Render

1. Push this repository to a private or public GitHub repository. Do not commit `.env` files, passwords, or downloaded connector JARs.
2. In Render, create a **Blueprint** from the repository and apply `render.yaml` (or create a Docker web service with `backend/Dockerfile`). The service listens on Render's injected `PORT`.
3. In the Render service's **Environment** settings, add:
   - `TIDB_HOST` — TiDB endpoint hostname
   - `TIDB_PORT` — `4000`
   - `TIDB_DATABASE` — `medistock`
   - `TIDB_USER` — TiDB-provided username
   - `TIDB_PASSWORD` — the newly rotated TiDB password
   - `FRONTEND_ORIGINS` — the exact Vercel origin, for example `https://your-project.vercel.app` (no trailing slash). Add additional allowed origins as comma-separated exact origins if needed.
4. Wait for the service to become healthy. Check `https://<your-render-service>.onrender.com/api/health`; it should return `{"status":"ok"}`.

Render's first build downloads Maven dependencies and can take a few minutes. The API's login-issued bearer tokens expire after 12 hours and are held in memory; a backend restart logs users out.

## 3. Deploy the frontend to Vercel

1. Import the same GitHub repository in Vercel. Keep the project root at the repository root; `vercel.json` uses `node build.mjs` and publishes `dist/`.
2. In Vercel project settings, add the environment variable `MEDISTOCK_API_URL` for Production (and Preview if used), set to the Render service origin, such as `https://<your-render-service>.onrender.com`. Do not add `/api` or a trailing slash.
3. Deploy. The build copies `frontend/` into `dist/` and generates `runtime-config.js` with the public API origin; no database secret is included in the frontend.
4. Copy the final Vercel origin into Render's `FRONTEND_ORIGINS`, save, and redeploy the backend if needed. This origin must exactly match the browser's address bar, including `https://` and any `www` subdomain.
5. Open the Vercel site, register an account, log in, then add/update/delete inventory. If requests fail, check the browser console, Render logs, CORS origin value, and TiDB IP access list.

## Run locally on Windows

Requirements: JDK 17+ and Maven 3.9+.

Copy `.env.example` to `.env` in the repository root and replace the placeholder values with your TiDB connection details. Use standard `KEY=VALUE` lines (do not include PowerShell `$env:` syntax). `.env` is ignored by Git and is loaded by the Java API for local development; never commit it or share its password.

Then, in PowerShell from the repository root:

```powershell
cd backend
mvn package
java -jar target\medistock-api-1.0.0.jar
```

Serve the `frontend/` directory using VS Code Live Server (usually `http://127.0.0.1:5500`) and open `index.html`. The local `frontend/runtime-config.js` points at `http://localhost:8080`.

## API summary

- `GET /api/health` — health check
- `POST /api/register` — create an account; request fields: `username`, `email`, `password`
- `POST /api/login` — authenticate and return a 12-hour bearer token
- `GET /api/medicines` — authenticated inventory listing
- `POST /api/medicines` — authenticated add
- `POST /api/medicines/update-quantity` — authenticated quantity update
- `POST /api/medicines/delete` — authenticated delete

Passwords are stored as PBKDF2 hashes. Inventory routes require the login token. This remains a learning/demo app: users currently share one inventory, session tokens are in-memory, and the app has not had a production security or healthcare-compliance review. Do not store patient or other regulated data in it.
