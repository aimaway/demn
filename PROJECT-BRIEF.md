# INFRACENTRA — COMPLETE PROJECT BRIEF (Single-File Handoff Document)

> **Purpose of this file:** Give any AI coder / developer the full context of this project in one read. Share ONLY this file + the error/logs you're facing, and they will understand the architecture, services, folders, files, known bugs, and how to fix them.
>
> **Last verified:** 2026-10-16 against the actual repository state (all facts below were checked against real files, not assumed).

---

## 1. WHAT THE PRODUCT IS

**Infracentra** is a multi-tenant MSSP (Managed Security Service Provider) platform: a SaaS-style security operations portal sold to client organizations ("tenants"). It has three audiences:

| Audience | Role string | Portal |
|---|---|---|
| Infracentra staff | `platform_admin` | Platform Admin (`/admin/*`) — sees ALL tenants |
| Client SOC manager | `client_admin` | Client Admin (`/client-admin/*`) — sees ONLY own tenant (org_id scoping) |
| Client staff | `client_user` | Client Portal (`/portal`) — read-only view of own tenant |

Two flagship paid services are implemented end-to-end with a **real backend** (SQLAlchemy + FastAPI + Postgres):

- **Service A — Advanced Ticketing System**: AI-assisted classification/prioritization, SLA timers + breach prediction + escalation worker, asset-linked incidents & CVE/vulnerability tracking, evidence vault, hash-chained immutable audit history, approval workflows for closure, multi-tenant views, team workload stats.
- **Service B — Notification & Event Intelligence Engine**: event-driven alert ingestion, configurable routing rules, severity-based escalation, alert correlation + dedup fingerprinting, notification-storm protection, delivery simulation (in_app/email/sms/webhook), retries + dead-letter queue, acknowledgement tracking, quiet hours, rule builder UI, analytics.

**Key product decision:** the app must run on ONE toggle for "demo". Demo mode = inject sample alerts through the REAL `/api/alerts` pipeline; everything downstream (correlation, notifications, auto-tickets) is produced by the real backend. No mock data in ticketing/notification/discovery/settings pages. Landing page marketing content is static data (that's fine).

**The killer integration (must always work):** when an alert arrives and matches a `notification_rule` whose `create_ticket=True`, the backend automatically creates a ticket linked to the alert (`tickets.alert_id`, `source='alert'`). Implemented in `backend/app/services/notifications.py::process_alert()` (calls `create_ticket` from `ticketing.py`; FIRST matching rule wins).

---

## 2. TECH STACK (versions actually pinned)

### Frontend
- React 18 + TypeScript + Vite 6.4.3, Tailwind CSS (see §9 gotcha about v3 vs v4 `@tailwindcss/postcss`), react-router-dom with **HashRouter** (URLs look like `http://localhost:3000/#/client-admin/advanced-tickets`).
- Built statically into `./dist/`, served by plain `nginx:latest` — **no Node needed at runtime**.
- API client: `src/services/api.ts` (JWT bearer from localStorage key `ic_token`, all requests go to relative `/api/...` which nginx proxies to the backend).

### Backend
- Python FastAPI + Uvicorn, SQLAlchemy 2.0 async + asyncpg, Alembic available but schema is created via `Base.metadata.create_all()` on startup (no migrations run manually).
- Auth: JWT (`python-jose[cryptography]`), passwords hashed with passlib bcrypt (**must be `bcrypt==4.0.1`**, see §9).
- Redis (official image) is present in compose but currently only used as a future cache; background jobs run as asyncio tasks inside the API process (no Celery — it was removed to fix crash-loops).
- Swagger docs at `http://localhost:8000/docs`.

### Data plane
- PostgreSQL 18 (official image). **PG18 layout gotcha:** volume MUST be mounted at `/var/lib/postgresql` (NOT `/var/lib/postgresql/data`) or the container crash-loops with "unused mount/volume" error. Already fixed in compose.

### Infra
- Docker Compose (`docker-compose.prebuilt.yml`) is the production-ish stack for Kali Linux. Network name: `infracentra-network` (compose project prefix e.g. `infrav3_infracentra-network`).

---

## 3. DEPLOYMENT TOPOLOGY (docker-compose.prebuilt.yml)

| Service | Image | Container name | Host port | Notes |
|---|---|---|---|---|
| frontend | `nginx:latest` | infracentra-frontend | 3000→80 | mounts `./dist` (ro) + `./frontend/nginx.conf` |
| backend | `python:3.12-slim` | infracentra-backend | 8000→8000 | mounts `./backend:/code`; deps installed once into named volume `venvdata` (`/opt/venv-data/.ready` marker), pip cache in `pipcache` volume |
| db | `postgres:18` | infracentra-db | 5432→5432 | volume `pgdata:/var/lib/postgresql`; user/pass/db all `infracentra`; healthcheck `pg_isready`, start_period 60s |
| redis | `redis:latest` | infracentra-redis | 6379→6379 | healthcheck ping |
| pgadmin (optional, added by user) | `dpage/pgadmin4:latest` | infracentra-pgadmin | 5050→80 | login `admin@infracentra.io` / `admin123`; register server: host `db`, port 5432, db/user/pass `infracentra` |

Volumes declared at root: `venvdata`, `pgdata`, `pipcache`. Network: `infracentra-network` (bridge).

Backend env vars set in compose: `DATABASE_URL=postgresql+asyncpg://infracentra:infracentra@db:5432/infracentra`, `REDIS_URL=redis://redis:6379/0`, `SECRET_KEY`, `ALGORITHM=HS256`, `ACCESS_TOKEN_EXPIRE_MINUTES=30`. Optional overrides: `PLATFORM_ADMIN_EMAIL`, `PLATFORM_ADMIN_PASSWORD` (defaults `admin@infracentra.io` / `Admin#2026`).

Nginx (`frontend/nginx.conf`): `location /api/ { proxy_pass http://backend:8000/api/; }` + SPA fallback `try_files $uri $uri/ /index.html;`. **If nginx fails with `host not found in upstream "backend"` → the backend container is down/restarting; fix backend first.**

**Run:** `sudo docker compose -f docker-compose.prebuilt.yml up -d` (add `--force-recreate` after code changes; `-v` also wipes DB).

---

## 4. REPOSITORY MAP (core folders/files only)

```
/workspace (git repo; user copy lives at ~/Téléchargements/INFRA v2/infrav3)
├── docker-compose.prebuilt.yml     # THE stack file (see §3)
├── docker-compose.yml              # older dev variant (ignore unless asked)
├── init_schema.sql                 # full DDL for all 15 tables (mirrors models.py; idempotent IF NOT EXISTS)
├── demo_accounts.sql               # idempotent seed: platform admin + Sarah Chen tenant + auto-ticketing rules
├── setup-kali.sh / fix-db-health.sh / RUN-ON-KALI.md   # bootstrap helpers
├── package.json vite.config.ts tailwind.config.js postcss.config.js tsconfig.json index.html
├── dist/                           # PREBUILT frontend bundle served by nginx (commit it; rebuild = npm install && npm run build)
├── frontend/nginx.conf             # nginx site config used by frontend container
│
├── src/                            # React app source
│   ├── App.tsx                     # HashRouter routes (§6 lists the important ones)
│   ├── main.tsx / index.css        # entry + Tailwind directives
│   ├── services/api.ts             # REAL API client: ticketsApi, alertsApi, playbooksApi, discoveryApi, settingsApi, pushDemoEvents()
│   ├── context/AuthContext.tsx     # login state, role handling, entitlement check (platform_admin bypasses)
│   ├── types/index.ts              # shared TS types incl. User['role']
│   ├── components/                 # Layout.tsx (sidebars per role), ServiceGate, Breadcrumb, Clock…
│   ├── data/                       # landing/marketing data (servicesData.ts = 16 catalog services; navigationData.ts)
│   │                               # ⚠ ticketingNotifData.ts was DELETED on purpose — do not reintroduce mock ticket data
│   └── pages/
│       ├── LandingPage.tsx LoginPage.tsx (+ landing/* sections)
│       ├── DashboardPage.tsx ThreatsPage.tsx CompliancePage.tsx IncidentsPage.tsx
│       ├── AnalyticsPage.tsx NetworkPage.tsx PSAPage.tsx ServiceDetailPage.tsx ComingSoonPage.tsx
│       ├── SettingsPage.tsx        # /settings — tabs Profile/Org/Security/Automation/Platform/Notifications + Seed demo tenant button
│       ├── ClientPortalPage.tsx    # client_user portal (live /api/tickets,/api/alerts,/api/notifications)
│       ├── platform/               # PlatformDashboardPage (has Setup & Demo panel), PlatformClientsPage,
│       │                           # PlatformAuditPage, PlatformIntegrationsPage, PlatformServicesOverviewPage (cross-tenant, org filter)
│       └── client-admin/
│           ├── AdvancedTicketingPage.tsx   # Service A UI (fetch /api/tickets, ?org_id= filter, Create-Ticket modal, detail drawer)
│           ├── NotificationEnginePage.tsx  # Service B UI (polls /api/alerts + /api/notifications, rule builder → /api/notification-rules)
│           ├── CustomPlaybooksLibrary.tsx  # CRUD /api/playbooks + Run button → POST /api/playbooks/{id}/run (server executes steps, returns log)
│           ├── MonitoredDevicesPage.tsx    # includes Auto-Discovery subsection (SNMP creds, scan CIDR, poll progress, snmp_match highlight, import)
│           ├── ClientAdminDashboardPage.tsx AlertsPage.tsx ClientEntitlementsPage.tsx ClientUsersPage.tsx …
│           └── (per-service pages: EmailSecurityPage, EndpointProtectionPage, CloudSecurityPage, SDWANPage,
│                VulnerabilityScanningPage, PatchManagementPage, BackupDRPage, SOARPage, DNSFilteringPage,
│                FirewallManagementPage, VPNGatewayPage, StatisticsPage + NetworkStatistics/DeviceStatistics/PerformanceStatistics,
│                ArchitectureDiagram, CustomerValueDashboard, SecurityHistoryTimeline, ComplianceReports, TechniciansManagementPage)
│
└── backend/
    ├── Dockerfile                  # python:3.11-slim variant (used only if compose switches to build:)
    ├── requirements.txt            # fastapi 0.109, uvicorn 0.27, sqlalchemy 2.0.25, asyncpg, pydantic 2.5.3,
    │                               # python-jose, bcrypt==4.0.1, passlib 1.7.4, email-validator 2.1.0, redis, httpx
    └── app/
        ├── main.py                 # lifespan: init_db() → ensure_platform_admin() → asyncio escalation loop (60s)
        ├── database.py             # async engine, AsyncSessionLocal, get_db, init_db(create_all)
        ├── models.py               # 15 SQLAlchemy models (§5)
        ├── schemas.py              # pydantic schemas (UserCreate uses EmailStr → needs email-validator)
        ├── core/config.py          # Settings (env-driven, .env supported)
        ├── core/security.py        # _b64_pad_sha pre-hash (SHA256→base64, 44 chars) then bcrypt; JWT create/decode; require_role
        ├── routers/
        │   ├── auth.py             # /api/auth/register|login|me
        │   ├── organizations.py    # /api/organizations CRUD (platform_admin)
        │   ├── users.py            # /api/users CRUD
        │   ├── entitlements.py     # /api/entitlements (service access per org)
        │   ├── integrations.py     # /api/integrations (Wazuh/MISP/Elastic config + test endpoints)
        │   ├── audit.py            # /api/audit/logs (+ my-org)
        │   ├── tickets.py          # /api/tickets — FULL Service A API (§7)
        │   ├── notifications.py    # /api/alerts + /api/notification-rules + /api/notifications — Service B API (§7)
        │   ├── discovery.py        # /api/discovery — SNMP creds, scans, devices, engine-status
        │   └── settings.py         # /api/settings/system GET+PUT, /api/settings/overview, /api/settings/seed-demo-tenant
        │                           #   ALSO defines router_playbooks: /api/playbooks CRUD + /{id}/run
        └── services/
            ├── ticketing.py        # apply_sla, sla_state, breach_prediction, run_escalations, classify (AI-style triage),
            │                       # find_duplicate, next_ticket_uid (TCK-nnnnnn), append_audit (hash chain), add_evidence,
            │                       # create_ticket, request_closure, decide_approval
            ├── notifications.py    # dedup_fingerprint, correlate, rule_matches, in_quiet_hours, deliver (simulated channels),
            │                       # dispatch (retry/dead-letter), process_alert (THE alert→auto-ticket hook), ack_notification,
            │                       # retry_dead_letters, analytics
            ├── discovery.py        # cidr_hosts, nmap_available, run_nmap (real nmap -Pn -F -T4 parse), snmp_probe (pysnmp if
            │                       # installed else deterministic simulated match), simulate_scan fallback, execute_scan, schedule_scan
            ├── seed.py             # ensure_platform_admin + seed_demo_tenant (creates org, client_admin, default rules incl. create_ticket=True)
            └── wazuh.py misp.py elastic.py   # optional external SIEM/threat-intel connectors (config-driven, unused if URLs unset)
```

---

## 5. DATABASE SCHEMA (15 tables — authoritative list)

Created automatically by SQLAlchemy `create_all()` at backend startup. `init_schema.sql` is the hand-written mirror (use it only if you want tables visible before first backend boot; never hand-add extra tables/columns — code only knows these).

| Table | Purpose / key columns |
|---|---|
| `organizations` | tenants: name, tier (enterprise/mid_market/sme), status, contact_email, member_count |
| `users` | email UNIQUE, hashed_password, name, **role ∈ {platform_admin, client_admin, client_user}**, org_id FK NULL for platform admins, status, mfa_enabled |
| `entitlements` | org_id × service_id access grants (plan/limits/expiry) |
| `integrations` | external connector configs (wazuh/misp/elastic…) + status |
| `audit_logs` | platform-wide actor/action/target log (actor_id FK → users.id; **deleting a user requires deleting these rows first**) |
| `tickets` | uid TCK-nnnnnn, org_id, title, description, status(new→closed), priority p1–p4, category(incident/service_request/problem/change/vulnerability/other), source(manual/alert/api/email/discovery), assignee, reporter, tags JSON, asset, vulnerability_ref(CVE); AI fields (ai_category, ai_priority, ai_confidence, ai_reasoning JSON, ai_predicted_root_cause, duplicate_of, triaged_at); SLA fields (sla_response_minutes, sla_resolution_minutes, due_response_at, due_resolve_at, first_response_at, resolved_at, escalation_level); **alert_id FK → alerts.id (auto-ticket link)** |
| `ticket_evidence` | evidence vault: ticket_uid, name, kind, content, sha256, immutable-style |
| `ticket_audit_entries` | hash-chained per-ticket history: seq, action, actor, detail, prev_hash, entry_hash (tamper-evident) |
| `ticket_approvals` | closure workflow: requested_by, approver, decision(pending/approved/rejected), note |
| `alerts` | uid ALT-, org_id, source, severity(info..critical), title, resource, raw JSON, fingerprint(dedup), correlated_count, ticket_uid (set when auto-ticketed), acknowledged |
| `notification_rules` | org-scoped routing: name, conditions JSON (severity/source/keyword), channels JSON, recipients JSON, **create_ticket bool**, storm_limit, quiet_hours JSON, enabled |
| `notifications` | deliveries: notif uid, rule_id, alert_id, channel, recipient, subject, status(sent/failed/queued/dead_letter/acknowledged), attempts, delivered_at, ack_by/at |
| `snmp_credentials` | name, version(v2c/v3), community/username, auth/priv pass, port, org_id |
| `discovery_scans` | org_id, network_cidr, status(running/completed/failed), results_count, started/finished |
| `discovered_devices` | scan_id, ip, hostname, mac, os_guess, device_type, open_ports JSON, **snmp_match bool**, imported flag |

Roles are rows in `users.role` — there is NO separate admins table. Tenant isolation is enforced in every router by filtering `org_id` (client roles can't query other orgs; platform_admin may pass `?org_id=`).

---

## 6. ROUTES & LOGIN FLOW (frontend)

HashRouter. Public: `/` (landing), `/login`, `/service/:id`, `/coming-soon/:id`. Protected (`ProtectedRoute` + `Layout` renders role-specific sidebar):

- Platform admin: `/admin/dashboard` (Setup & Demo panel: seed tenant, demo alerts, quick links), `/admin/clients`, `/admin/audit`, `/admin/integrations`, `/admin/services-ops` (cross-tenant overview + working tenant filter), plus access to `/client-admin/*` views and `/settings`.
- Client admin: `/client-admin/dashboard`, `/client-admin/advanced-tickets`, `/client-admin/notifications`, `/client-admin/playbooks`, `/client-admin/monitored-devices` (Auto-Discovery subsection), `/client-admin/alerts`, `/client-admin/entitlements`, `/client-admin/technicians`, per-service pages, `/client-admin/value-dashboard`, `/client-admin/compliance-reports`.
- Client user: `/portal`. Shared: `/settings` (GET/PUT /api/settings/system + Seed demo tenant button).
- `/client-admin/tickets` → redirects to `/client-admin/advanced-tickets` (old basic ticketing section was deleted; do not restore it).

Login: `POST /api/auth/login {email,password}` → `{access_token}` stored as `ic_token`. Password hashing uses SHA-256→base64 pre-hash then bcrypt (so legacy >72-byte failures can't recur). **Fresh DB auto-creates the platform admin** (`ensure_platform_admin` in lifespan).

### Working demo accounts
| Email | Password | Role | Tenant |
|---|---|---|---|
| admin@infracentra.io | Admin#2026 | platform_admin | — (all tenants) |
| sarah.chen@aegiscorp.io | Client#2026 | client_admin | Aegis Corp (enterprise) — full demo |
| marcus.j@aegiscorp.io | Client#2026 | client_user | Aegis Corp |
| jordan@techstart.io | Client#2026 | client_admin | TechStart (sme) |
| client@acme-corp.com | Client#2026 | client_admin | created by "Seed demo tenant" button |

Sarah/TechStart accounts come from `demo_accounts.sql` (psql) OR the seed endpoint; acme comes from `/api/settings/seed-demo-tenant`. If login says "invalid credentials" after recreating users with SQL hashes, the hash function must match `security.py` (pre-hashed bcrypt) — safest is DELETE the user row (and its `audit_logs` refs!) and let backend re-seed, or use `demo_accounts.sql` which embeds correct hashes.

---

## 7. BACKEND API SURFACE (what the UI calls)

Auth-guarded except `/api/auth/login|register`. Prefix `/api`.

- **Tickets** (`tickets.py`): `GET /tickets?org_id=&status=&priority=&q=` (returns items+total; org filter works — the old "filter does nothing" bug is fixed), `POST /tickets` (full create incl. priority/category/asset/assignee/tags/CVE; platform admins pick tenant), `GET /tickets/meta/tenants` (tenant dropdown for platform admin), `GET/PATCH /tickets/{uid}`, `GET/POST /tickets/{uid}/evidence`, `GET /tickets/{uid}/audit` (verify hash chain), `POST /tickets/{uid}/closure-request`, `GET /tickets/{uid}/approvals`, `POST /tickets/{uid}/approvals/{id}/decide`, `GET /tickets/ops/workload`, `POST /tickets/ops/run-escalations` (manual trigger of the SLA escalation worker).
- **Notification engine** (`notifications.py`): `POST /alerts` (ingest — runs dedup/correlation/rules/**auto-ticket**), `GET /alerts?org_id=`, `POST /alerts/{id}/ack`, `GET/POST /notification-rules`, `PATCH/DELETE /notification-rules/{id}`, `GET /notifications?org_id=`, `POST /notifications/{id}/ack`, `POST /notifications/retry-dead-letters`, `GET /notifications/analytics`.
- **Playbooks** (`settings.py::router_playbooks`): `GET/POST /playbooks`, `PUT/DELETE /playbooks/{id}`, `POST /playbooks/{id}/run` (server executes saved steps sequentially and returns a step-by-step log — the Play button shows REAL execution, Display shows saved steps).
- **Discovery** (`discovery.py`): `GET/POST/DELETE /discovery/snmp-credentials`, `GET/POST /discovery/scans` (POST body: cidr + credential ids; runs in background), `GET /discovery/scans/{id}` (progress polling), `GET /discovery/scans/{id}/devices`, `GET /discovery/devices`, `POST /discovery/devices/{id}/import`, `GET /discovery/engine-status` (tells whether real nmap is available; falls back to deterministic simulation inside containers without nmap).
- **Settings** (`settings.py`): `GET/PUT /settings/system` (persisted system settings driving SLA/auto-ticketing/notification engines), `GET /settings/overview` (tenants/users counts etc.), `POST /settings/seed-demo-tenant`.
- Core: `/auth/*`, `/organizations/*`, `/users/*`, `/entitlements/*` (+`/check/{service_id}`), `/integrations/*` (+`/{id}/test`), `/audit/logs`.

Frontend single demo toggle = `pushDemoEvents()` in `src/services/api.ts`: posts sample alerts to the real `POST /api/alerts` for the selected org (then correlation → notifications → auto-tickets appear live in both pages).

---

## 8. DEMO SCRIPT FOR CLIENTS (end-to-end happy path)

1. `sudo docker compose -f docker-compose.prebuilt.yml up -d` → wait healthy.
2. Login `admin@infracentra.io` / `Admin#2026` → Platform dashboard → **Setup & Demo panel** → *Seed demo tenant* (or run `demo_accounts.sql` for Sarah's full tenant).
3. Toggle **Demo Mode** → sample alerts flow in → open **Notification Engine**: alerts feed populates, notifications dispatched, storm protection visible.
4. Open **Advanced Ticketing**: auto-created tickets with `source=alert` appear, AI triage badges, SLA countdowns/breach predictions; click **New Ticket** to create manually (all fields persist); open a ticket → evidence vault, hash-chained audit, closure approval flow.
5. **Monitored Devices → Auto-Discovery**: create SNMP credential → Start scan (e.g. `127.0.0.1/30` or lab CIDR) → watch progress → snmp_match rows → Import.
6. **Playbooks**: create/edit playbook → **Play** (server-run step log) → **Display**.
7. Logout → login `sarah.chen@aegiscorp.io` / `Client#2026` → she sees ONLY Aegis Corp data (tenant isolation demo). Also show `jordan@techstart.io` sees different numbers.
8. Show `/settings` automation toggles + `/admin/services-ops` cross-tenant filter.

---

## 9. KNOWN ISSUES HISTORY + GOTCHAS (READ BEFORE DEBUGGING)

These all happened and were fixed — respect them or you'll regress:

1. **Postgres 18 volume layout**: mount `pgdata:/var/lib/postgresql` ONLY. Mounting `/var/lib/postgresql/data` (or leaving an old bind dir `./pg-data`) → "unused mount/volume" crash-loop → db unhealthy. Stale volumes need `docker compose down -v` or `docker volume rm <proj>_pgdata`.
2. **bcrypt/passlib war**: `passlib 1.7.4` breaks with `bcrypt>=4.1` (`AttributeError __about__`, then `ValueError: password cannot be longer than 72 bytes` during its bug-detection probe). Fix = pin `bcrypt==4.0.1` AND keep the SHA-256→base64 pre-hash in `security.py`. Never remove `_b64_pad_sha`.
3. **email-validator required**: `schemas.py` uses pydantic `EmailStr`; missing module crashes whole app at import. Pinned in requirements.
4. **Compose shell one-liner fragility**: backend `command:` is a folded YAML scalar executed by `sh -c`. Multi-line `if/then/fi` written across YAML lines → `[: Syntax error: expecting "then"` crash-loop. Keep it a single logical line joined with `&&`/`;` exactly as in the current file. `mkdir: missing operand` = same class of breakage.
5. **Never `pip install --no-cache-dir=false`** (invalid; that caused the original crash-loop). The compose installs once into `venvdata` volume, guarded by `.ready`.
6. **Windows/WSL `:cached` volume flags** caused stale code inside the container (edited host file ≠ container file). All mounts are plain now; if code edits don't take effect: `docker exec infracentra-backend grep ... /code/...` to compare, then `--force-recreate`. On Kali prefer copying the repo OUT of `~/Téléchargements` paths with spaces/parentheses if anything weird happens (`mv ... ~/infrav3`).
7. **Tailwind v4 vs v3**: build error *"trying to use tailwindcss directly as a PostCSS plugin"* = wrong major installed. Repo is aligned to `@tailwindcss/postcss` (v4). Don't mix. If build is troublesome, just `git pull` + serve committed `dist/` — no local build needed.
8. **npm not found / sudo npm**: run `npm install` (no sudo) before `npm run build`; `vite: not found` = node_modules missing.
9. **nginx `host not found in upstream "backend"`** = backend container down/restarting; nginx exits → frontend missing from `docker ps`. Fix backend, then `up -d`.
10. **Deleting users**: `audit_logs.actor_id` FK blocks deletion → delete referencing audit_logs rows first (or CASCADE).
11. **502 on ticket create** historically = backend crash-looping (issues 2/3/4). Always check `docker logs infracentra-backend` before touching frontend.
12. **`docker compose down` leaves network "in use"** = orphan pgadmin attached → `docker stop/rm infracentra-pgadmin` or `down --remove-orphans`.
13. **pgAdmin empty Tables tree** = looking at wrong DB (maintenance `postgres`) or didn't Refresh; verify via `docker exec -it infracentra-db psql -U infracentra -d infracentra -c '\dt'`.
14. **Do NOT reintroduce mock data files** (`ticketingNotifData.ts` deleted intentionally). Old basic ticketing section and Dashboard Builder were removed by design.
15. Requirements were slimmed (celery/pymisp/elasticsearch dropped) — heavy optional connectors live in `services/*.py` behind config/env checks.

### Quick troubleshooting commands
```bash
sudo docker ps -a                                   # who is restarting/exited?
sudo docker logs --tail 50 infracentra-backend      # python tracebacks
sudo docker logs --tail 30 infracentra-frontend     # nginx emerg lines
curl -s http://localhost:8000/docs -o /dev/null -w "%{http_code}\n"   # expect 200
curl -s http://localhost:3000/api/health -o /dev/null -w "%{http_code}\n" # nginx→backend proxy alive
curl -s -X POST http://localhost:3000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@infracentra.io","password":"Admin#2026"}' | head -c 200   # expect access_token
sudo docker exec infracentra-db psql -U infracentra -d infracentra -c '\dt'      # 15 tables?
sudo docker exec infracentra-db psql -U infracentra -d infracentra -c 'SELECT email,role FROM users;'
```

---

## 10. CURRENT STATE / REMAINING WORK (as of 2026-10-16)

**Done:** backend fully functional (all routers/services above), frontend rewired to real APIs (ticketing, notifications, playbooks, discovery, settings, portal, platform overview), tenant filtering works, alert→auto-ticket verified in code (`process_alert`), demo toggle `pushDemoEvents()`, compose stack stable on Kali, pgAdmin sidecar documented, `init_schema.sql` + `demo_accounts.sql` seeds.

**Open / to improve (candidates for next session):**
- Live smoke-test the full demo script on the user's machine after last security.py fixes (user reported login issues tied to stale images — rebuild/recycle solved similar cases).
- Add `nmap` (and optionally `pysnmp`) to the backend runtime so Auto-Discovery uses the REAL scanner instead of the deterministic simulator (`apt-get install -y nmap` in the install-once branch of the backend command, or bake into a built image via backend/Dockerfile).
- Persist `SECRET_KEY` outside compose (env file) before any public exposure.
- Real SMTP/SMS/webhook senders replacing `deliver()` simulation (channel interface already isolated in `services/notifications.py::deliver`).
- Alembic migrations if schema starts evolving in production (currently create_all only).
- Optional: WebSocket instead of polling for alerts feed (pages currently poll).

**When reporting a bug to another AI:** paste this file + `docker ps` output + the relevant `docker logs` tail + the failing curl/browser error. That is sufficient context.
