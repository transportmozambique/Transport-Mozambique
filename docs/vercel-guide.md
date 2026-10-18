# Vercel, step by step

The three apps run on [Vercel](https://vercel.com), in the team `transportmozambique`. This page shows the parts of the Vercel dashboard the project uses, with screenshots taken on 2026-10-18:
- environment variables, where the keys live;
- deployments, which put a change live or take it back;
- logs, which show every request and what the code printed.

How a change gets from a branch to production, and how to check it, is in [Deployment](deployment.md).

**On this page:** [The three projects](#the-three-projects) · [Environment variables](#environment-variables) · [Deployments](#deployments) · [Logs](#logs)

---

## The three projects

Sign in at [vercel.com](https://vercel.com) and choose the team **transportmozambique** at the top left. Each app is a project, built from its folder of the repository:

| Project | Folder | URL | Its variables |
|---|---|---|---|
| `transport-mz` | `transport-client` | https://transport-mz.vercel.app | [passenger app, USSD, GPS intake](configuration.md#transport-client-passenger-app-ussd-driver-api-gps-intake) |
| `transport-mz-admin` | `transport-admin` | https://transport-mz-admin.vercel.app | [admin](configuration.md#transport-admin-back-office) |
| `transport-mz-driver` | `transport-driver` | https://transport-mz-driver.vercel.app | [driver portal](configuration.md#transport-driver-driver-portal) |

Open a project from the team's overview. Its left menu holds the pages below.

## Environment variables

**Project → Environment Variables** lists every variable, the environments it applies to, and when it changed. Values are hidden.

![transport-mz environment variables](images/vercel-env-vars.png)

**Add one.** Click **Add Environment Variable**:

![Add Environment Variable form](images/vercel-env-add.png)

1. **Type.**
   - **Secret:** the value cannot be shown again after saving. Use it for passwords, API keys, tokens and session secrets.
   - **Config:** readable by the project's members. Use it for values that are not secret, such as `AFRICASTALKING_USERNAME`.
2. **Key** and **Value.** The names the code reads are listed in [Configuration](configuration.md).
3. **Environments.**
   - **Production:** the live URL.
   - **Preview:** the deployments of branches and pull requests.
   - **Development:** `vercel dev` on a laptop.

   Keep keys that send real SMS or write to production out of Preview.
4. **Save,** then [redeploy](#deployments). Running functions keep the values they started with until the next deployment.

**"Needs Attention".** Vercel marks secrets stored as Config. On `transport-mz`, `USER_SESSION_SECRET` and `DRIVER_SESSION_SECRET` are marked. To fix them:
- add each one again as a **Secret** with a new random value;
- delete the Config one;
- redeploy.

New session secrets sign every passenger and driver out once ([Security → Rotating secrets](security.md#rotating-secrets)).

**Changing `DATABASE_URL`** (after resetting the Neon password, for example) is the same: edit it in `transport-mz` and `transport-mz-admin`, then redeploy both.

## Deployments

**Project → Deployments** lists every build, newest first:
- **Preview:** a branch or pull request, each with its own URL;
- **Production:** `main`, served at the project's URL.

A pull request gets its previews automatically. Merging it into `main` deploys Production in about 30 seconds per project. Each row shows the commit, the status (**Ready**, **Building**, **Error**) and the build time.

![transport-mz deployments, with the menu of the newest Production deployment open](images/vercel-deployments.png)

The **⋯** menu of a deployment:

| Item | What it does |
|---|---|
| **Redeploy** | builds the same commit again. Needed after changing environment variables. |
| **Instant Rollback** | (Production) serves an older deployment at once, without building. Use it when a release breaks; then fix and merge. |
| **Promote** | makes a Preview deployment the Production one. |
| **Inspect Deployment** | the build log and the functions of that deployment. |
| **Visit** | opens the deployment's URL. |

After a production deploy of `transport-mz`, check that the USSD callback still refuses requests without the key ([Africa's Talking → Test](africas-talking.md#7-test)), and the checks in [Deployment → Checking a deploy](deployment.md#checking-a-deploy).

## Logs

**Project → Logs** shows every request of the last hours: time, status, host, path, and the first message the code logged.
- Type a path in the search box (`/api/ussd`, `/api/gps`, `/api/buses`) to see only those requests.
- **Contains Console Level** keeps only requests that logged a warning or an error.
- **Live** follows new requests as they arrive.

![Logs of transport-mz searched for /api/ussd: one POST per keypress of a simulator session, and two requests refused without the key](images/vercel-logs-ussd.png)

Click a row to open the request: its timing, the route, and everything the function logged. For USSD that is `📱 USSD Request` with the session's `text`, then `📤 USSD Response`:

![The logs of one USSD request](images/vercel-log-request.png)

What the apps log, and where to look for each problem, is in [Troubleshooting](troubleshooting.md).

**Treat the logs as sensitive:**
- They contain phone numbers (USSD, SMS).
- A request's details show the URL's search parameters, which include the USSD callback key. Do not share screenshots of a request's details.
- Give log access only to people who may know those.

---

[← Viewing the data in Neon](neon-guide.md) · [Documentation index](README.md) · Next: [Configuration →](configuration.md)
