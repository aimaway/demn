# Guide — Fast Demo Access + Platform Admin Settings + Trial Accounts

## 1. Fast access: skip the login page (guarded demo-only shortcut)

The login page is **NOT deleted** — it is bypassed by a guarded fast-demo switch, so you can always restore it in one second.

### Enter the demo instantly
Open either of these URLs (works on Kali and Windows):

```
http://localhost:5173/#/demo      ← always works, no setup
```

This auto-enables Demo Mode (`ic_demo_mode=1`), signs you in as the full-access
client admin (all 16 services + Advanced Ticketing), and lands directly on
`/#/client-admin/dashboard`. **Zero backend required, zero network calls.**

### Make /login itself jump straight into the demo (optional)
If you want the login page completely hidden during the test phase:

**Per browser (no rebuild):** open DevTools console once and run:
```js
localStorage.setItem('ic_fast_demo', '1'); location.reload();
```
From now on `/#/login` redirects automatically into the demo environment.

**Globally (rebuilt bundle):** create a file `.env.local` next to `package.json`:
```
VITE_FAST_DEMO=true
```
then `npm run build`. Every visitor's `/login` now goes straight to the demo.

### Guard & restore
- The fast path **only** activates the client-side simulated session. It can
  never authenticate against the real backend — production data stays isolated.
- To bring back the normal login page: clear the flag
  (`localStorage.removeItem('ic_fast_demo')`) or remove `VITE_FAST_DEMO` and rebuild.
- Real users who need a genuine account are onboarded via **Settings → Demo
  Accounts** (section 3), which creates real DB accounts with trials.

## 2. Settings section for platform admins (now first-class)

Route: `/#/settings` (already linked in the sidebar for every role).

Tabs available to **Platform Admins**:
| Tab | What it manages |
|---|---|
| **Demo Accounts** *(new, default tab)* | Create real trial accounts for external users (see §3) |
| Profile | Account details |
| Organization | Tenant info |
| Security (2FA) | MFA status per user — same as client admin |
| Automation | Real toggles → `PUT /api/settings/system` (auto-ticketing, SLA escalations, channels…) |
| Platform | Tenants/users/rules overview from `GET /api/settings/overview` |
| Notifications | Global channel config |

Non-admin roles that stumble onto the Demo Accounts tab see a **“Restricted
area — Platform Admins only”** guard; the API additionally enforces
`403 Platform administrators only` server-side.

## 3. Create a real demo/trial account for a real user (30-day trial)

As a platform admin (e.g. `ops@infracentra.io` with Demo Mode **OFF**, or any
seeded admin), go to **Settings → Demo Accounts** and fill:

- **Real user email** → becomes the client-admin login of the new tenant
- **Company/Org name** → new organization row
- **Initial password** → hashed with bcrypt, stored in DB
- **Trial duration (days)** → default **30**; entitlements get an expiry stamp
- **Service selection** → checkbox “All 16 platform services”, plus individual
  pickers, plus separate toggle for **Advanced Ticketing (Pro/Enterprise)**

Click **Create demo/trial account**. Backend call:

```
POST /api/settings/seed-demo-tenant
{ "email": "...", "password": "...", "org_name": "...",
  "service_ids": ["threat-intel", ..., "advanced-ticketing"],
  "trial_days": 30 }
```

What happens in the database (real rows, not mocks):
1. `organizations` ← new tenant (tier professional, status active)
2. `users` ← client admin with bcrypt-hashed password
3. `entitlements` ← one row per selected service, `enabled=true`,
   `deactivated_at = now + trial_days` (the 30-day trial window)
4. `notification_rules` ← default critical/high auto-ticketing rules
5. Duplicate emails are rejected with `409 Conflict`.

The evaluator then logs in for real (Demo Mode OFF) with the credentials you
generated; when the trial expires their entitlements carry the expiry date and
can be revoked/extended from the Entitlements page.

## 4. Running it (Kali & Windows)

| Goal | Windows | Kali |
|---|---|---|
| Fast demo, no backend | double-click `start.bat` → open `#/demo` | `./start-kali.sh` → open `#/demo` |
| Real full-stack | `start-fullstack.bat` (Docker Desktop running) | `docker compose -f docker-compose.prebuilt.yml up -d && npm run dev` |

After pulling these changes, if you use `vite preview` instead of `npm run dev`,
rebuild first: `npm run build`.
