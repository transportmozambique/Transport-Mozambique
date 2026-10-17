# Africa's Talking

[Africa's Talking](https://africastalking.com) (AT) is the gateway between phone networks and the platform. It carries two things:

- **USSD:** a phone dials the service code, and AT relays every keypress to `POST /api/ussd` on the passenger app ([USSD service](ussd.md)).
- **SMS:** the passenger app sends USSD results, arrival alerts and driver trip confirmations through AT's SMS API.

The platform runs on the **sandbox** today. Sandbox USSD and SMS only reach AT's web simulator, not real phones. This page covers the account, how the sandbox is wired, testing in the simulator, and what going live involves.

**On this page:** [Current setup](#current-setup) · [Account and apps](#account-and-apps) · [USSD channel](#ussd-channel) · [SMS](#sms) · [Try it in the simulator](#try-it-in-the-simulator) · [Logs and sessions](#logs-and-sessions) · [Going live](#going-live)

---

## Current setup

| Item | Value |
|---|---|
| AT account | the `transportmozambique` account |
| App | Sandbox, username `sandbox` |
| USSD service code | `*384*848080#` (channel `848080` on the shared sandbox code `*384#`) |
| Callback URL | `https://transport-mz.vercel.app/api/ussd`, without a callback key yet (`USSD_CALLBACK_KEY` not set) |
| Vercel project | `transport-mz`: `AFRICASTALKING_USERNAME=sandbox`, `AFRICASTALKING_API_KEY` (sandbox key, stored as sensitive) |
| Sender ID (`AFRICASTALKING_SHORTCODE`) | not set: SMS go out from AT's default sender |
| Verified | USSD menus and SMS end to end in the simulator, 2026-10-16 |
| Live (real phones in Mozambique) | not set up ([Going live](#going-live)) |

## Account and apps

<img src="images/at-home.png" alt="Africa's Talking home: Go To Sandbox App, and Teams for production apps" width="720">

An AT account has one **sandbox app** ("Go To Sandbox App") for free testing and any number of **teams** with production apps. Each app has its own username and API key; the code reads both from the environment ([Configuration](configuration.md#transport-client-passenger-app-ussd-driver-api-gps-intake)).

<img src="images/at-sandbox-dashboard.png" alt="Sandbox app dashboard: App Name Sandbox, Username sandbox" width="720">

**API key.** Sandbox → Settings → API Key. Generating a new key invalidates the previous one. A fresh key can take a few minutes before the API accepts it; until then AT answers "The supplied authentication is invalid". After changing the key on Vercel, redeploy `transport-mz` so the functions read it.

## USSD channel

<img src="images/at-ussd-service-codes.png" alt="USSD Service Codes: *384*848080# with callback https://transport-mz.vercel.app/api/ussd" width="720">

AT offers two kinds of service code:

- **Dedicated** codes such as `*144#`, issued by the regulator or the operator;
- **Shared** codes such as `*384*848080#`: a channel number on AT's code. The sandbox only supports these.

To create or change the sandbox channel: **USSD → Create Channel**, pick the shared code `*384#`, choose a free channel number and enter the callback URL.

<img src="images/at-ussd-create-channel.png" alt="Create USSD Channel form: shared service code, channel, callback URL" width="720">

The callback must be the public HTTPS URL of `/api/ussd` on the passenger app. When `USSD_CALLBACK_KEY` is set on `transport-mz`, add it to the URL (`https://transport-mz.vercel.app/api/ussd?key=<value>`): requests without it get 403, so nobody but Africa's Talking can drive the menus with someone else's phone number ([Security → USSD callback](security.md#ussd-callback)). Change the variable and the URL together. A preview deployment's URL also works, for testing a branch before merging, but put the production URL back afterwards. AT sends, for each keypress, a form-encoded `POST` with `sessionId`, `serviceCode`, `phoneNumber`, `networkCode` and `text`. The app answers `text/plain` beginning with `CON` (continue) or `END` (close). The protocol and every menu are in [USSD service](ussd.md#how-a-session-works).

## SMS

`transport-client/lib/notifications.ts` sends every SMS with the `africastalking` SDK:

- **Recipient.** The phone is normalised to `+258…` first (`"84 123 4567"`, `"0841234567"` and `"258841234567"` all become `+258841234567`).
- **Sender.** `from` is `AFRICASTALKING_SHORTCODE` when it is set, otherwise AT's default.
- **No key.** Without `AFRICASTALKING_API_KEY`, nothing is sent and the log says `SMS não enviado para … AFRICASTALKING_API_KEY não configurada`.
- **Failures never break a flow.** A failed send is logged (`❌ Erro ao enviar SMS para …`) and the USSD screen or arrival check carries on.

What is sent:

| Trigger | Message | Where |
|---|---|---|
| USSD options 1 to 6, on the final screen | the screen's content (option 1 only when asked) | after the response, with `waitUntil` ([USSD](ussd.md)) |
| Arrival alert | "Autocarro {matrícula} está a {n} minutos da {paragem}!" | the arrival check ([Data flow](data-flow.md#arrival-alert-and-sms)) |
| Driver starts or ends a trip on USSD | "Viagem iniciada com sucesso! Veiculo: … Bons trabalhos!" / "Viagem encerrada com sucesso. …" | USSD option 6 |

**In the sandbox**, messages only reach phones open in the simulator. AT's sandbox messaging API is sometimes slow and can answer "The server was not able to produce a timely response" without anything being wrong on the platform's side; the send is logged as an error and not retried.

## Try it in the simulator

1. Sign in at [account.africastalking.com](https://account.africastalking.com), open the sandbox app and click **"Launch Simulator"** (or go to the [simulator](https://developers.africastalking.com/simulator) directly).
2. Enter a phone number in international format, for example `+258840000001`, and connect.
3. Choose **USSD** and dial `*384*848080#`. The main menu of production appears:

   ![The main menu in the simulator](images/at-sim-main-menu.png)

4. Navigate with the keypad. `7` and `8` page through long lists, `0` goes back ([USSD → How a session works](ussd.md#how-a-session-works)).
5. After a final screen, open **Messages** in the simulator: the same result arrives as an SMS.

   ![SMS received in the simulator](images/at-sim-sms.png)

The simulated phone number is what the app receives as `phoneNumber`. Option 1 creates a passwordless passenger for that number and an arrival alert in the **production** database. Use a test number such as `+25884000000x`, and see [Database](database.md#passengers-created-by-ussd-no-password-yet) to find or remove what it created.

To test the driver menu (option 6), enter a driver's phone number in the simulator and use the PIN the admin generated for that driver ([Admin dashboard → Drivers](admin-dashboard.md#drivers-motoristas)).

## Logs and sessions

<img src="images/at-ussd-sessions.png" alt="USSD Sessions log: date, service code, phone number, hops, duration, status" width="720">

- **AT side:** USSD → **Sessions** lists every session with its number of hops, duration and status. "Incomplete" means the phone left the session before an `END` screen, or the callback did not answer in time.
- **Platform side:** the Vercel function logs of `transport-mz` show each USSD request and response (`📱 USSD Request`, `📤 USSD Response`, PINs masked as `***`) and each SMS result.

## Going live

The code needs no change to go live; the account and configuration do. In order:

1. **Coverage.** Confirm with AT that USSD and SMS are available on the Mozambican networks you need (Vodacom, Movitel, Tmcel), and on which kind of code. This was not confirmed at the time of writing.
2. **Production app.** On the AT home page, create a **Team**, then an app in it. Note its username, and generate its API key.
3. **Service code.** Request a USSD code for that app (a dedicated code from the regulator or operator, or a channel on a shared code). Set its callback URL to `https://transport-mz.vercel.app/api/ussd?key=<USSD_CALLBACK_KEY>`, and set that variable on `transport-mz` (Production) to a random value.
4. **Sender ID (optional).** Request an alphanumeric sender ID or short code for SMS, then set `AFRICASTALKING_SHORTCODE` to it.
5. **Credit.** Top up the app's wallet: live USSD sessions and SMS are billed.
6. **Vercel.** In `transport-mz`, set `AFRICASTALKING_USERNAME` to the app's username and `AFRICASTALKING_API_KEY` to its key, for **Production** only (keep previews keyless so they never send real SMS). Redeploy ([Deployment](deployment.md)).
7. **Test** with a real phone on each network: the main menu, one option of each kind, an arrival SMS, and a driver trip.
8. **Clean up.** Revoke API keys of accounts no longer used ([Security → Rotating secrets](security.md#rotating-secrets)).

---

[← GPS tracking](gps-tracking.md) · [Documentation index](README.md) · Next: [API reference →](api-reference.md)
