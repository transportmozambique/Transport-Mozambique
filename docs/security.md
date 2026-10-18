# Security

How each kind of user and device authenticates, what is stored and how, which endpoints are public, how to rotate secrets, and the gaps that are still open.

**On this page:** [Overview](#overview) · [Admin dashboard](#admin-dashboard) · [Passengers](#passengers) · [Drivers](#drivers) · [GPS devices](#gps-devices) · [USSD callback](#ussd-callback) · [Public endpoints](#public-endpoints) · [Stored secrets and personal data](#stored-secrets-and-personal-data) · [Rotating secrets](#rotating-secrets) · [Known gaps](#known-gaps)

---

## Overview

| Who | Proves who they are with | Gets | Lifetime | Checked by |
|---|---|---|---|---|
| Administrator | email + password | `admin_session` cookie (`HttpOnly`, `SameSite=Lax`, `Secure` in production) | 12 hours | `transport-admin/proxy.ts`, on every `/api/*` |
| Passenger (web) | phone + password | Bearer token | 90 days | each `/api/user/*` route |
| Driver (portal) | phone + 6-digit PIN | Bearer token | 30 days | `/api/driver/trip`, `/api/driver/seguidores` |
| Driver (USSD option 6) | the calling phone number + PIN, on every request | nothing (USSD is stateless) | one USSD session | `/api/ussd` |
| GPS device | its device code | nothing (sent with each position) | until revoked | `/api/gps` |
| Africa's Talking | optionally, a key in the callback URL ([below](#ussd-callback)) | | | `/api/ussd` |

All three session kinds are **signed tokens, not database rows**: `<id>.<expires-at>.<HMAC-SHA256 signature>` (`transport-client/lib/signedToken.ts`, `transport-admin/lib/adminSession.ts`). The server checks the signature with a constant-time comparison and the expiry, and needs no session table. Each kind has its own secret:

| Secret | App | Without it in production |
|---|---|---|
| `ADMIN_SESSION_SECRET` | admin | sign-in answers 500 and every `/api/*` answers 401 |
| `USER_SESSION_SECRET` | passenger app | registration and sign-in answer 500; `/api/user/*` answers 401 |
| `DRIVER_SESSION_SECRET` | passenger app | driver sign-in answers 500; driver endpoints answer 401 |

Missing secrets **fail closed** in production. In development a fixed development-only key is used, so a local setup works without them.

## Admin dashboard

- Passwords are bcrypt hashes (`Administrador.senha`, cost 10). No API returns them: the administrator endpoints select explicit fields.
- `proxy.ts` guards `/api/*` only. The pages themselves are static client code that shows nothing without the API, and the browser app signs out on any 401.
- The first administrator is created with `node create-admin.js`, which asks for the password (at least 10 characters) without echoing it. The "Administradores" page accepts 6 characters.
- All administrators have the same rights; there are no roles.
- The admin's Prisma client omits `Motorista.password` (the PIN hash) from every query; only the PIN route reads it, with an explicit `select`.

## Passengers

- Registration (`POST /api/auth/register`) stores a bcrypt hash of the password (at least 6 characters). Sign-in (`POST /api/auth/login`) returns a token valid 90 days, kept in the browser's `localStorage['utente']`.
- Every `/api/user/*` endpoint reads the passenger id from the token and acts only on that passenger: a profile id or a `utenteId` that is not the token's answers 401, and an alert that belongs to someone else answers 404.
- **Phone numbers are not verified.** There is no SMS code at registration. Someone who knows a phone number that has only been used on USSD can register with it and take over that passwordless account, including its alerts ([Known gaps](#known-gaps)).
- USSD creates passengers with the placeholder password `temp`, which is not a bcrypt hash, so sign-in refuses it ("Este número ainda não tem senha").

## Drivers

- Drivers never choose a secret. The admin generates a **6-digit PIN** with `crypto.randomInt` and sees it once; `Motorista.password` keeps only its bcrypt hash. "Gerar novo PIN" replaces it, and the old PIN stops working at once ([Admin dashboard → Drivers](admin-dashboard.md#drivers-motoristas)).
- The portal sends phone + PIN to `POST /api/driver/login` and gets a token valid 30 days. A new PIN does **not** end sessions already open with the old one; rotate `DRIVER_SESSION_SECRET` to end all driver sessions ([Rotating secrets](#rotating-secrets)).
- On USSD, option 6 asks for the PIN in every session and trusts the calling number. The PIN is masked as `***` in the logs.
- The driver endpoints answer `Access-Control-Allow-Origin: *` because the portal is on another domain. That is safe here because they authenticate with a Bearer token, not a cookie.
- A driver's token lets them read their own profile, vehicle and route, start and end their trip, and count waiting passengers. It cannot send GPS positions (that needs the device code) or read anyone else's data.

## GPS devices

- Each vehicle can have one device code: 20 characters, 120 random bits. Only its SHA-256 is stored (`Transporte.gpsDispositivoHash`); a fast hash is enough for a random secret of this length.
- Whoever holds the code can set the vehicle's position for passengers. Treat it like a password; "Gerar novo código" or "Revogar dispositivo" cuts a leaked one off immediately.
- `/api/gps` answers `Access-Control-Allow-Origin: *` so the driver portal can post from the browser.

## USSD callback

Africa's Talking does not sign its callbacks, and `/api/ussd` is a public URL. The menus trust the `phoneNumber` field: results are sent to it by SMS, option 1 creates a passenger and an alert for it, and option 6 signs a driver in by it. Without a check, anyone could post to the endpoint with someone else's number.

Set **`USSD_CALLBACK_KEY`** on `transport-mz` to a random value and register the callback with it:

```text
https://transport-mz.vercel.app/api/ussd?key=<USSD_CALLBACK_KEY>
```

Requests without the right key then get `403 Forbidden`. Without the variable, the endpoint answers everyone (the behaviour until 2026-10-17). Set the variable and change the callback URL in Africa's Talking together, then redeploy ([Africa's Talking → USSD channel](africas-talking.md#ussd-channel)). `/api/ussd-telerivet` has the same kind of check with `TELERIVET_SECRET`.

## Public endpoints

Endpoints that answer without any credential, on purpose:

| Endpoint | Exposes or does |
|---|---|
| `/api/startup`, `/api/simulation` (`GET`) | counts of buses and of the last arrival check |
| `POST /api/simulation {"action":"check"}` | runs the arrival-SMS check now; only SMS that are due go out |
| `/api/stops`, `/api/stops/{id}`, `/api/destinos`, `/api/journeys`, `/api/viagem`, `/api/buses`, `/api/bus/{id}` | the network (routes, stops, paths), journeys between stops, and vehicle positions, plates and fares. A position sent to `/api/journeys`, `/api/destinos` or `/api/viagem` is not saved in the database, but it is part of the URL, so it appears in Vercel's request logs. |
| `/api/walk` | a street path between two points. The points, rounded to about 45 m by the page and 11 m by the server, are sent on to the FOSSGIS router (`routing.openstreetmap.de`) from the server, so FOSSGIS sees the server, not the passenger. The rounded points are in the URL, so they appear in Vercel's request logs, and the CDN keeps the answer a week for anyone asking for the same points. |
| `POST /api/auth/register`, `/api/auth/login`, `/api/driver/login` | sign-in |
| `/api/ussd` | the USSD menus (see [USSD callback](#ussd-callback)) |

No public endpoint returns passengers' or drivers' personal data.

The legacy root app (`app/`, not deployed) has unauthenticated admin endpoints. It must never be deployed as is ([Known limitations](known-limitations.md)).

## Stored secrets and personal data

| Data | Stored as |
|---|---|
| Administrator passwords | bcrypt (`Administrador.senha`) |
| Passenger passwords | bcrypt (`Utente.senha`); `temp` for USSD-only accounts |
| Driver PINs | bcrypt (`Motorista.password`) |
| GPS device codes | SHA-256 (`Transporte.gpsDispositivoHash`) |
| Session tokens | not stored; signed |
| Environment secrets | Vercel environment variables (sensitive values cannot be read back); local `.env` files, git-ignored |

Personal data in the database: passengers' names, emails, phone numbers and waiting stops (`MISSION`); drivers' names, ID and licence numbers, birth dates, addresses, phones and emergency contacts; owners' ID numbers and contacts. Database dumps and screenshots of the admin carry this data: keep them off shared drives and blur real people's data before publishing a screenshot. (The people in this documentation's screenshots are demo records from the initial data import or local test accounts.)

## Rotating secrets

| Secret | How | Effect |
|---|---|---|
| `ADMIN_SESSION_SECRET`, `USER_SESSION_SECRET`, `DRIVER_SESSION_SECRET` | New value (`openssl rand -base64 32`) in the Vercel project, Production and Preview, then redeploy | Every session of that kind ends; users sign in again. This is the way to end all sessions at once. |
| `AFRICASTALKING_API_KEY` | Generate a new key in Africa's Talking (the old one stops working), set it on `transport-mz`, redeploy | SMS fail between the two steps; USSD keeps working. A new key can take a few minutes to be accepted. |
| `USSD_CALLBACK_KEY` | New value on `transport-mz` and in the AT callback URL, redeploy | USSD answers 403 until both match. |
| Database password | Neon → Roles → reset the password, then update `DATABASE_URL` in all three projects (Production and Preview) and in local `.env` files, redeploy all three | Everything fails until the new URL is deployed; do it in a quiet hour. |
| A driver's PIN | "Gerar novo PIN" in the admin | The old PIN stops working; open portal sessions stay valid (rotate `DRIVER_SESSION_SECRET` to end them). |
| A GPS device code | "Gerar novo código" or "Revogar dispositivo" | The old code gets 401 at once. |

Revoke the API keys of accounts that are no longer used (for example, an earlier Africa's Talking account).

## Known gaps

| Gap | Risk | Possible fix |
|---|---|---|
| No limit on sign-in attempts (admin, passengers, drivers) | A 6-digit PIN has a million values; an attacker who knows a driver's phone can try them through `/api/driver/login` | Count failures per account and lock for a while after a few (needs a table), or put the sign-in routes behind a rate limiter |
| Phone numbers are not verified | Account takeover of USSD-only passengers; registration with someone else's number | One-time SMS code at registration |
| Sessions cannot be revoked one by one | A leaked token works until it expires (up to 90 days for passengers) | Store a per-account session version and check it |
| `/api/ussd` open until `USSD_CALLBACK_KEY` is set | SMS to arbitrary numbers once SMS are live; PIN guessing over USSD | Set the key ([above](#ussd-callback)) |
| No roles in the admin | Every administrator can manage administrators | Roles on `Administrador` |
| `/api/simulation` `POST` is public | Anyone can trigger the arrival check (it only sends SMS that are due) | Require a secret, or remove the action |

---

[← Testing](testing.md) · [Documentation index](README.md) · Next: [Troubleshooting →](troubleshooting.md)
