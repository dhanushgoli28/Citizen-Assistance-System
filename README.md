# Citizen Assistance System

CitizenAssist helps citizens discover assistance and manage service workflows. The current delivery establishes the frontend, FastAPI foundation, Supabase Auth/PostgREST integration, and initial database security policies.

## Architecture

```text
frontend/                     React + Vite application
  src/services/               Axios API and feature service modules
backend/
  app/api/routers/             FastAPI auth, profile, scheme, document, legal, and application routes
  app/core/                    Environment configuration and shared errors
  app/schemas/                 Pydantic request/response validation
  app/services/                Supabase, Gemini, document, and activity services
  tests/                       API foundation tests
supabase/
  config.toml                  Local Supabase development configuration
  migrations/                  PostgreSQL schema, RLS, and private storage policies
```

User-scoped database requests use Supabase PostgREST with the authenticated user's access token, so PostgreSQL Row Level Security enforces ownership. The only privileged operations are the two fixed document/application status RPCs. Their backend-only `SUPABASE_SERVICE_ROLE_KEY` must never be added to frontend configuration or returned to users; all other profile and data requests continue to use the user's token. The schema prepares the planned profile, family, scheme/rules, document/extraction, legal conversation/message, application, notification, and activity entities.

Scheme content is not seeded by the application. Scheme Finder displays only records published in Supabase; eligibility is evaluated from their stored rules and the signed-in user's profile/family details. Smart Forms create generic drafts only; they do not submit applications to government services.

## Local setup

### Explore the no-account demo

The demo works without Supabase, Gemini, or a running backend. From `frontend/`, run:

```powershell
npm ci
npm run dev
```

In development, demo mode is enabled by default. Open the Vite URL and choose **Explore Demo**. No demo credentials are needed. Demo profile edits, sample forms, notification state, and other interactions persist in that browser's local storage; use **Reset demo** to restore the fictional sample workspace. The demo data is fictional and is not sent to the backend.

Set `VITE_DEMO_MODE=true` explicitly for a public demo build. When demo mode is off, the application uses the existing real-auth/API flows; demo mode does not change backend authentication, Supabase RLS, or production authorization.

### Backend

Python 3.11+ is recommended. From the repository root:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
if (!(Test-Path .env)) { Copy-Item .env.example .env }
```

For real authenticated features, set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `backend/.env` using the Supabase project's public project URL and anon/publishable key. Registration uses `AUTH_EMAIL_REDIRECT_URL=http://127.0.0.1:5173/auth/callback`; add that exact URL to Supabase Auth's allowed Redirect URLs. Add `GEMINI_API_KEY` only to the backend environment for real AI requests; never place it in frontend configuration. The backend-only `SUPABASE_SERVICE_ROLE_KEY` is required only for privileged status RPCs. These external services are not required to explore the demo. Then run:

```powershell
uvicorn app.main:app --reload
```

- API docs: <http://127.0.0.1:8000/docs>
- Health check: <http://127.0.0.1:8000/health>

The initial schema configures RLS and a private `citizen-documents` storage bucket; it does not seed scheme data. Check the target project's migration history before applying anything. Do not rerun the initial migration against a project where it is already recorded.

### Frontend

In another terminal:

```powershell
cd frontend
npm ci
if (!(Test-Path .env.local)) { Copy-Item .env.example .env.local }
npm run dev
```

The Vite development server proxies `/api` and `/health` to the local backend. `VITE_API_URL` may be set to the deployed API origin; leave it unset for same-origin requests. Production builds must receive the deployment's API URL when frontend and backend use different origins.

`frontend/.env.example` documents `VITE_DEMO_MODE=true`. Development mode defaults to the demo when this variable is not set; production builds default to demo-off unless explicitly configured. Demo document uploads validate file type and signature locally, keep only file metadata, and show scripted sample analysis; they do not upload file contents or perform OCR. Legal replies are scripted, not Gemini-generated. Demo application statuses are illustrative and do not represent government submissions.

The OCR service also needs the Tesseract executable on the local machine and on the server. Install Tesseract for Windows and make `tesseract.exe` available on `PATH`; Render's backend Docker image installs `tesseract-ocr`. Digital PDF text extraction does not require Tesseract.

Run backend tests from the repository root with the backend virtualenv:

```powershell
$env:PYTHONPATH = (Join-Path (Get-Location) "backend")
.\backend\.venv\Scripts\python.exe -m pytest -q .\backend\tests
```

Run `npm run lint` and `npm run build` from `frontend/`.

## Render deployment

`render.yaml` defines a Docker-backed FastAPI service and a React/Vite static site with SPA rewrites. The backend health check uses `/health` and does not require external service credentials, allowing the demo site to start. The static site sets `VITE_DEMO_MODE=true` and leaves `VITE_API_URL` empty so demo interactions remain local and do not depend on the API. Connect this repository to Render and deploy the Blueprint yourself. For real authenticated/API features, configure the following private settings in Render before switching demo mode off:

- Backend: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `AUTH_EMAIL_REDIRECT_URL`, and `CORS_ORIGINS` (only for real API features).
- Frontend build: `VITE_API_URL` to the public FastAPI service URL (only when real API features are enabled).
- Supabase Auth URL Configuration: set the Site URL to `https://<your-render-static-site-host>` and add `https://<your-render-static-site-host>/auth/callback` to allowed Redirect URLs. Set backend `AUTH_EMAIL_REDIRECT_URL` to that same callback URL.
- Backend `CORS_ORIGINS`: JSON array containing the exact static-site origin, for example `["https://<your-render-static-site-host>"]`.

The deployed hostname and environment values are not known until Render creates the services. Set them in Render and the Supabase Dashboard before testing production authentication. A successful local build or YAML parse is not a deployment.

## Phase 1 API surface

- `GET /health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/password-reset`
- `POST /api/auth/resend-verification`
- `POST /api/auth/verify`
- `POST /api/auth/exchange-code`
- `PUT /api/auth/password`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/users/profile`
- `PUT /api/users/profile`
- `GET/POST/PATCH/DELETE /api/users/family`
- `GET /api/dashboard`
- `GET /api/schemes` and `POST /api/schemes/{id}/eligibility`
- `GET/POST/DELETE /api/documents`, plus download, extraction, and analysis endpoints
- `GET/POST/PATCH/DELETE /api/applications`, with PDF export and document associations
- `GET /api/forms/templates`, `POST /api/forms/validate`, and `POST /api/forms/generate`
- `GET /api/notifications` and `PATCH /api/notifications/{id}/read`
- `POST /api/legal/chat`, `GET /api/legal/conversations`, and conversation-message history (authenticated; Gemini uses official-source grounding)

Email verification, password recovery, live Gemini requests, owner-isolation against two real accounts, Render deployment, and production URL behavior require the real external services and account access. Do not infer their success from local tests or presence of environment variables. Supabase email provider settings and rate-limit/auth logs must be checked in the Supabase Dashboard if delivery is failing.
