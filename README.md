# Event Registration & Ticketing System

Serverless event registration and ticketing on AWS (us-east-1). It replaces a manual Microsoft Forms + Excel workflow. There are two entry points:

- Public registration portal (`/register/...`): attendees self-register for events, no account needed
- Coordinator console (`/auth` and the `_authenticated` routes): staff manage events, check attendees in, print badges, and run reports

**Status**

| Area                | State                                                                                   |
| ------------------- | --------------------------------------------------------------------------------------- |
| Backend API         | Live: 15 Python 3.13 Lambdas behind API Gateway, plus the email worker Lambda           |
| Frontend            | Live on Amplify Hosting (the workflow deploys on push to `main`); `bun run dev` locally |
| Confirmation emails | Live: registration publishes to SNS, the email Lambda sends through SES                 |
| Staff management    | Console page is a stub; in-app staff management is planned                              |
| CI (GitHub Actions) | Live: OIDC federation to AWS, no IAM users, no static keys                              |

---

## Architecture

![Architecture](docs/architecture.png)

Four CloudFormation stacks, deployed in dependency order. Each stack imports the exports of the previous ones:

| Stack                   | Contents                                                 |
| ----------------------- | -------------------------------------------------------- |
| `event-with-me-auth`    | Cognito user pool, app client, three groups              |
| `event-with-me-data`    | 3 DynamoDB tables, SNS confirmation topic, DLQ queue     |
| `event-with-me-lambdas` | 15 API Lambdas on a shared role, email Lambda on its own |
| `event-with-me-api`     | REST API Gateway with Cognito authorizer, stage `prod`   |

Templates are generated, not hand-written. `infra/generate-template.mjs` emits `infra/*.yaml`. Edit the generator, never the YAML.

---

## Frontend

React 19 + Vite + TypeScript with TanStack Router and Query, Tailwind, and shadcn/ui. It builds as a static SPA (`vite build`) and is served from Amplify.

```bash
bun install
cp .env.example .env   # fill in the four VITE_ values from the stack outputs
bun run dev            # http://localhost:5173
```

Scripts: `bun run build`, `bun run lint`, `bun run format`. Type-check with `npx tsc --noEmit`.

**Auth.** `src/lib/auth/cognito-client.ts` signs in over Cognito SRP (`amazon-cognito-identity-js`). Every API call carries the ID token as `Authorization: Bearer <idToken>`. `src/lib/hooks/use-auth.ts` derives `isAdmin`, `isRegOfficer`, and `isCheckinOfficer` from the token's `cognito:groups` and controls what navigation each user sees. The API enforces the real rules.

**Data access.** All HTTP calls live in `src/lib/api-client.ts`, which reads `VITE_API_URL`. TanStack Query handles caching and refetching.

**Amplify.** The app `event-with-me` (app id `d2378xfhyngm6g`) serves production. Pushes to `main` run `.github/workflows/deploy-frontend.yml`: lint, typecheck, `bun run build`, then `dist/` is zipped and uploaded through the Amplify deployment API (create deployment, PUT the artifact, start and wait for the job). The four `VITE_` values are in that workflow's Build step. `amplify.yml` remains for console-based hosting if it is ever needed.

### Screenshots

In [docs/screenshots](docs/screenshots):

| Login                                   | Dashboard                                       | Participants                                          | Check-in                                    | Walk-in                                    | Reports                                     |
| --------------------------------------- | ----------------------------------------------- | ----------------------------------------------------- | ------------------------------------------- | ------------------------------------------ | ------------------------------------------- |
| ![login](docs/screenshots/01-login.png) | ![dashboard](docs/screenshots/03-dashboard.png) | ![participants](docs/screenshots/05-participants.png) | ![checkin](docs/screenshots/06-checkin.png) | ![walkin](docs/screenshots/07-walk-in.png) | ![reports](docs/screenshots/08-reports.png) |

Plus `02-login-filled`, `04-events`, `09-audit`, `10-settings`, `11-staff` (currently the Cognito-instructions stub), `12-register-public`.

---

## Backend

### API endpoints (API Gateway REST, stage `prod`)

| Method + path                         | Auth    | Lambda                |
| ------------------------------------- | ------- | --------------------- |
| `GET /events`                         | none    | `ListEvents`          |
| `POST /events`                        | Admin\* | `CreateEvent`         |
| `GET /events/{eventId}`               | JWT     | `GetEvent`            |
| `PUT /events/{eventId}`               | Admin\* | `UpdateEvent`         |
| `DELETE /events/{eventId}`            | Admin\* | `DeleteEvent`         |
| `POST /events/{eventId}/register`     | none    | `RegisterParticipant` |
| `GET /events/{eventId}/registrations` | JWT     | `ListRegistrations`   |
| `POST /events/{eventId}/walk-in`      | JWT     | `WalkInRegistration`  |
| `GET /registrations/by-email/{email}` | JWT     | `GetRegistrations`    |
| `GET /registrations/{id}`             | JWT     | `GetRegistration`     |
| `PUT /registrations/{id}`             | JWT     | `UpdateRegistration`  |
| `DELETE /registrations/{id}`          | JWT     | `DeleteRegistration`  |
| `POST /registrations/{id}/checkin`    | JWT     | `CheckIn`             |
| `POST /registrations/{id}/print`      | JWT     | `PrintBadge`          |
| `GET /audit`                          | Admin\* | `GetAuditLog`         |

\* Requires a Cognito JWT; the star marks handlers that additionally enforce `isAdmin()` (or the officer roles) in code. `OPTIONS` on every path returns CORS headers from the Lambda. The CORS origin comes from the `ALLOWED_ORIGIN` env var, set through the lambdas stack's `AllowedOrigin` parameter (default `*`; repoint it with `scripts/update-cors-origin.sh`).

### Lambda functions

16 functions, Python 3.13. The 15 API functions are defined in `FUNCS` in `infra/generate-template.mjs`. Each zip contains the handler and the `shared/` package: `db.py` (boto3 clients), `response.py` (CORS and JSON helpers), `ids.py` (UUID and registration number), `auth.py` (claims extraction, `isAdmin`, audit writer). The API functions share one role: CloudWatch Logs, DynamoDB access to the three tables, and publish on the confirmation topic.

`SendConfirmationEmail` (`backend/notifications/sendConfirmationEmail.py`) is the 16th. It serves no API route. The confirmation topic triggers it, and it runs on its own least-privilege role: send mail through SES, stamp `emailSentAt` on the registration it emailed, and unsubscribe addresses on the topic. See "Email pipeline" below.

### Data model (DynamoDB, PAY_PER_REQUEST)

- **event-with-me-events** - PK `eventId`; name, date, venue, description, registrationOpen, badge styling fields, timestamps
- **event-with-me-registrations** - PK `registrationId`; GSI `email-eventId-index` (duplicate-email check, by-email lookup) and GSI `eventId-createdAt-index` (roster newest-first); registrationNumber, attendee details, `registrationType` (online|walk_in), check-in and badge-print tracking
- **event-with-me-audit-logs** - PK `auditId`; action, entity, entityId, actorId/Label, meta, createdAt

### Email pipeline

1. `RegisterParticipant` writes the registration, then publishes a message with the attendee and event details to the `event-with-me-confirmations` SNS topic. A publish failure is logged and does not fail the registration.
2. The topic triggers `SendConfirmationEmail` over the Lambda protocol, so SNS retries failed deliveries. The handler sends the email through SES (`sesv2`, `send_email`) from the `SES_SOURCE_EMAIL` variable (stack parameter `SourceEmail`), stamps `emailSentAt` on the registration, and writes an audit entry.
3. A message that keeps failing is redriven to `event-with-me-confirmations-dlq` (14-day retention). Inspect it with `aws sqs receive-message` and publish it back to the topic to replay.

SES rejects mail from an unverified sender. Verify the sender mailbox once: `aws ses verify-email-identity --email-address <address>`, then confirm the click-through with `aws ses get-identity-verification-attributes`. The account is currently in the SES sandbox, which only allows sending to verified addresses. Remove sandbox access from the SES console before real attendees can receive mail.

---

## Deploying & operating

### How we deployed it

**Backend: one command.**

```bash
scripts/deploy-stack.sh   # base name default: event-with-me
```

The script does five things:

1. zips every handler together with the `shared/` package,
2. uploads each zip to `s3://event-with-me-deploy-<account>/event-with-me/<name>-<hash>.zip`,
3. regenerates the four stack templates from `infra/generate-template.mjs`, embedding the hash in each S3 key,
4. creates or updates the stacks in dependency order: `auth`, `data`, `lambdas`, `api`,
5. redeploys the API `prod` stage so it serves the latest API definition.

The hash in the S3 key is what makes a code change visible to CloudFormation. With a fixed key, an updated zip would be ignored and the function keeps running the old code.

The stack outputs are the configuration of the whole system: API base URL (from `event-with-me-api`), user pool ID and app client ID (from `event-with-me-auth`), table, topic, and DLQ names (from `event-with-me-data`). After the deploy a smoke call proves the API is up:

```bash
curl https://<api-id>.execute-api.us-east-1.amazonaws.com/prod/events   # -> []
```

**Frontend: Amplify, deployed by CI.** The Amplify app `event-with-me` (app id `d2378xfhyngm6g`) serves the site. We do not use Amplify branch builds. On every push to `main`, `.github/workflows/deploy-frontend.yml` runs lint and typecheck, builds with bun, zips `dist/`, and uploads it through the Amplify deployment API (create a deployment, PUT the artifact, start the job, wait for success). The four `VITE_` values live in that workflow's Build step, so hosting needs no Amplify environment configuration.

**Updates: CI only.** After the first deploy nothing is hand-deployed. A push to `main`/`dvlp` touching `backend/**/*.py` runs `.github/workflows/deploy-lambda-code.yml`: pytest gates a deploy job that zips each function, runs `lambda update-function-code`, and redeploys the API stage. Frontend pushes run the Amplify deploy above.

**Authentication to AWS: OIDC, not IAM users.** Each workflow requests `permissions: id-token: write` and assumes one scoped deploy role via `aws-actions/configure-aws-credentials@v4` with `role-to-assume: ${{ vars.AWS_DEPLOY_ROLE_ARN }}`. That role's trust policy federates the GitHub OIDC provider (`token.actions.githubusercontent.com`) scoped to this repo, deploys are gated on the `production` GitHub environment, and no `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` secrets exist anywhere.

**Two one-time steps we had to do.** SES refuses mail from an unverified sender, so we verified the sender mailbox with `aws ses verify-email-identity`, clicked the confirmation link, and set the mailbox as the lambdas stack parameter `SourceEmail`. The AWS account is also in the SES sandbox, which only delivers to verified addresses; production access must be requested in the SES console before real attendees receive mail. And after the frontend got its domain, we repointed the CORS origin from `*` with `scripts/update-cors-origin.sh`.

### Deploy your own copy

The whole backend parameterizes on the stack base name, so a personal deployment is the same command plus a handful of edits:

```bash
scripts/deploy-stack.sh my-events
```

That creates the artifact bucket (`event-with-me-deploy-<account>`), the four stacks, and all their names (`my-events-events`, `my-events-RegisterParticipant`, and so on) in your account. Then:

1. **Read your outputs.** `aws cloudformation describe-stacks --stack-name my-events-api` (and `-auth`, `-data`) give you the API URL, user pool ID, and app client ID.
2. **Create the first Admin.**

   ```bash
   aws cognito-idp admin-create-user \
     --user-pool-id <UserPoolId> \
     --username you@yourorg.com \
     --temporary-password 'Admin@1234' \
     --user-attributes Name=name,Value="Your Name"
   aws cognito-idp admin-add-user-to-group \
     --user-pool-id <UserPoolId> --username you@yourorg.com --group-name Admin
   ```

   The first sign-in at `/auth` forces a permanent password.

3. **Run the frontend locally.** Copy `.env.example` to `.env`, paste your four values (`VITE_API_URL`, `VITE_COGNITO_USER_POOL_ID`, `VITE_COGNITO_CLIENT_ID`, `VITE_AWS_REGION`), then `bun install && bun run dev`.
4. **Make email work.** Verify your sender mailbox (`aws ses verify-email-identity --email-address you@yourorg.com`, then click the link) and set it on the stack:

   ```bash
   aws cloudformation update-stack --stack-name my-events-lambdas --use-previous-template \
     --parameters ParameterKey=SourceEmail,ParameterValue=you@yourorg.com
   ```

   Request SES production access in the console before mailing real attendees.

5. **Host the frontend.** Run `bun run build` and serve `dist/` anywhere static (it needs an SPA rewrite to `index.html`, same as `amplify.yml`'s `customRules`). Point CORS at your domain: `scripts/update-cors-origin.sh`.
6. **Optional CI.** Create a scoped IAM role in your account (lambda update, API stage redeploy, Amplify deployment, the artifact bucket, `iam:PassRole` on the stack roles) with a trust policy for the GitHub OIDC provider scoped to your repo; store its ARN as the `AWS_DEPLOY_ROLE_ARN` repo variable and gate it behind a `production` environment. No static keys.

If you reuse our workflows as-is, these values are hardcoded to our deployment and need editing:

| What            | Where                                                                | Our value                         |
| --------------- | -------------------------------------------------------------------- | --------------------------------- |
| Stack base name | CI assumes the default; pass yours to `deploy-stack.sh`              | `event-with-me`                   |
| Amplify app id  | `deploy-frontend.yml`, three `--app-id` flags                        | `d2378xfhyngm6g`                  |
| `VITE_` values  | Build step env of `deploy-frontend.yml`, plus local `.env`           | from your stack outputs           |
| Region          | both workflows deploy `us-east-1`; Cognito and SES are region-scoped | `us-east-1`                       |
| SES sender      | lambdas stack parameter `SourceEmail`                                | placeholder `noreply@yourorg.com` |
| CORS origin     | lambdas stack parameter `AllowedOrigin`                              | `*`                               |

---

## Cognito roles

| Group                 | Access                                               |
| --------------------- | ---------------------------------------------------- |
| `Admin`               | Full access: events, staff, reports, settings, audit |
| `RegistrationOfficer` | Walk-in registration, participants                   |
| `CheckinOfficer`      | Check-in, walk-in (limited)                          |

Enforcement lives in the handlers (`shared/auth.py`); the API Gateway Cognito authorizer rejects invalid or expired tokens first.

---

## Testing

```bash
backend/.venv/bin/python -m pytest tests -q   # or: python -m pytest backend/tests
```

19 pytest tests (`backend/tests/`) with faked DynamoDB tables via `conftest.py` helpers. Frontend gates: `bun run lint`, `npx tsc --noEmit`, `bun run build`.

---

## Badge printing

The badge is **100 mm x 60 mm landscape**. In Chrome's print dialog: paper 100x60 mm landscape, margins none, headers/footers off.

---

## Project structure

```
backend/
  events/            5 event handlers (.py)
  registrations/     10 registration handlers (.py)
  notifications/     sendConfirmationEmail.py (SNS topic -> SES)
  shared/            db.py, response.py, ids.py, auth.py
  tests/             pytest suite
  requirements-dev.txt

infra/
  generate-template.mjs   source of truth for the 4 CFN stacks

scripts/
  deploy-stack.sh         zip, hash, upload, stack deploy
  update-cors-origin.sh   repoint AllowedOrigin

src/
  lib/               api-client.ts, auth/cognito-client.ts, hooks/use-auth.ts, ...
  routes/            TanStack file-based routes (see src/routes/README.md)
  components/        UI components

docs/
  screenshots/       12 UI screenshots
  architecture.png   diagram export (editable .drawio kept untracked locally)

.github/workflows/
  deploy-lambda-code.yml  pytest, zip, update-function-code (OIDC deploy)
  deploy-frontend.yml     lint, typecheck, build, Amplify ZIP deploy (OIDC deploy)

amplify.yml               build config for Amplify console hosting (ZIP deploys bypass it)
.env.example              the four VITE_ values to copy into .env
```
