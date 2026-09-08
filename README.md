# Event Registration & Ticketing System

A serverless AWS event registration and ticketing system that replaces a manual Microsoft Forms + Excel workflow. Two user-facing surfaces:

- **Public registration portal** (`/register/...`): attendees self-register for events, no account needed
- **Coordinator console** (`/auth` + `_authenticated` routes): staff manage events, check attendees in, print badges, and run reports

**Status at a glance**

| Area                | State                                                                              |
| ------------------- | ---------------------------------------------------------------------------------- |
| Backend API         | Live: 15 API Lambdas + 1 email Lambda, Python 3.13, behind API Gateway (us-east-1) |
| Frontend            | Live on Amplify Hosting (ZIP deploy on push to `main`); `bun run dev` locally      |
| Confirmation emails | Live: registration → SNS topic → `SendConfirmationEmail` Lambda → SES              |
| Staff management    | Console page is a stub; in-app staff management is a planned workstream            |
| CI (GitHub Actions) | Live: deploys use OIDC federation (no IAM users, no static keys)                   |

---

## Architecture

![Architecture](docs/architecture.png)

Four CloudFormation stacks, deployed in dependency order (each imports the previous stacks' exports):

| Stack                   | Contents                                                |
| ----------------------- | ------------------------------------------------------- |
| `event-with-me-auth`    | Cognito user pool, app client, three groups             |
| `event-with-me-data`    | 3 DynamoDB tables + SNS confirmation topic + DLQ queue  |
| `event-with-me-lambdas` | 15 API Lambdas + shared role, email Lambda + own role   |
| `event-with-me-api`     | REST API Gateway with Cognito authorizer + stage `prod` |

Templates are **generated**, not hand-written: `infra/generate-template.mjs` emits `infra/*.yaml`. Edit the generator, never the YAML.

---

## Frontend

TanStack Start (React 19 + Vite + TypeScript), styled with Tailwind + shadcn/ui.

```bash
bun install
cp .env.example .env   # fill in the four VITE_ values from your stacks
bun run dev            # http://localhost:5173
```

Scripts: `bun run build`, `bun run lint`, `bun run format`. Type-check with `npx tsc --noEmit`.

**Auth flow:** `src/lib/auth/cognito-client.ts` signs in over Cognito SRP (`amazon-cognito-identity-js`). The ID token goes out as `Authorization: Bearer <idToken>` on every call. `src/lib/hooks/use-auth.ts` derives `isAdmin` / `isRegOfficer` / `isCheckinOfficer` from the token's `cognito:groups` and drives navigation visibility (the API enforces the real rules).

**Data access:** all HTTP lives in `src/lib/api-client.ts`, which reads `VITE_API_URL`; TanStack Query handles caching and refetch.

**Amplify Hosting: connected.** The Amplify app `event-with-me` (app id `d2378xfhyngm6g`) serves the production frontend. Pushes to `main` run `.github/workflows/deploy-frontend.yml`: lint + typecheck + `bun run build`, then the build is zipped and uploaded through the Amplify ZIP-deploy API (`create-deployment` → PUT `zipUploadUrl` → `start-deployment`, polling until the job succeeds). The four `VITE_` values live in that workflow's Build step env. `amplify.yml` (bun build, serve `dist/`, SPA rewrite) remains for console-based hosting if ever needed.

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

\* Requires a Cognito JWT; `*` marks handlers that additionally enforce `isAdmin()` (or officer roles) in code. `OPTIONS` on every path returns CORS headers from the Lambda. CORS origin comes from the `ALLOWED_ORIGIN` env var, set via the lambdas stack's `AllowedOrigin` parameter (default `*`; repoint with `scripts/update-cors-origin.sh`).

### Lambda functions

16 functions, Python 3.13. The 15 API functions are defined in `FUNCS` in `infra/generate-template.mjs`; each zip ships its handler plus the `shared/` package (`backend/shared/`: `db.py` boto3 clients, `response.py` CORS+JSON helpers, `ids.py` UUID + registration number formatter, `auth.py` claims extraction, `isAdmin`, audit writer). They share one role: CloudWatch Logs + DynamoDB access on the three tables + publish on the confirmation topic.

The 16th is `SendConfirmationEmail` (`backend/notifications/sendConfirmationEmail.py`): not an API route, triggered by the SNS confirmation topic, and running under a separate least-privilege role (send mail via SES, stamp `emailSentAt` on one table, unsubscribe from the topic). See "Email pipeline" below.

### Data model (DynamoDB, PAY_PER_REQUEST)

- **event-with-me-events** - PK `eventId`; name, date, venue, description, registrationOpen, badge styling fields, timestamps
- **event-with-me-registrations** - PK `registrationId`; GSI `email-eventId-index` (duplicate-email check, by-email lookup) and GSI `eventId-createdAt-index` (roster newest-first); registrationNumber, attendee details, `registrationType` (online|walk_in), check-in and badge-print tracking
- **event-with-me-audit-logs** - PK `auditId`; action, entity, entityId, actorId/Label, meta, createdAt

### Email pipeline (confirmation emails)

1. `RegisterParticipant` writes the registration, then publishes a confirmation message (attendee + event details) to the `event-with-me-confirmations` SNS topic. This is best-effort: a publish failure is logged but the registration itself still succeeds.
2. The SNS topic is subscribed to `SendConfirmationEmail` (Lambda protocol, so SNS retries on failure). The handler sends the confirmation email through **SES** (v2 `sendEmail`) from `SES_SOURCE_EMAIL` (stack parameter `SourceEmail`, default `noreply@azubisuccess.space`), stamps `emailSentAt` on the registration, and writes an audit entry.
3. A message that keeps failing is redriven to the `event-with-me-confirmations-dlq` SQS queue (14-day retention). Inspect it with `aws sqs receive-message` and republish to the topic to replay.

The sender identity **must be verified in SES** before any mail goes out; `verify-email-identity` / `verify-domain-identity`, then confirm with `aws ses get-identity-verification-attributes`.

---

## Deploying & operating

### First deploy of the backend

```bash
scripts/deploy-stack.sh   # optional arg: base name (default event-with-me)
```

The script works in five steps:

1. zips every handler together with the `shared/` package,
2. uploads each zip to `s3://event-with-me-deploy-<account>/event-with-me/<name>-<hash>.zip`,
3. regenerates the four stack templates from `infra/generate-template.mjs`, embedding the hash in each S3 key,
4. creates or updates the stacks in dependency order: `auth` → `data` → `lambdas` → `api`,
5. redeploys the API `prod` stage so it serves the latest API definition.

The hash in the S3 key is what makes a code change visible to CloudFormation. With a fixed key, an updated zip would be ignored and the function would keep running the old code.

Once the stacks exist, read their outputs (`aws cloudformation describe-stacks --stack-name event-with-me-api`, etc.): the API base URL, user pool ID, and app client ID go into `.env` for local development; the production frontend reads them from the build env in `deploy-frontend.yml`.

### CI: GitHub Actions

`.github/workflows/deploy-lambda-code.yml` triggers on pushes to `main`/`dvlp` touching `backend/**/*.py` (plus manual dispatch): a `test` job (Python 3.13, pip, pytest) gates a `deploy` job that zips each function and runs `lambda update-function-code`, then redeploys the API `prod` stage. `.github/workflows/deploy-frontend.yml` lints, typechecks, builds, and pushes the bundle to Amplify.

AWS auth is **OIDC federation, not IAM users**: each workflow requests `permissions: id-token: write`, and the deploy step uses `aws-actions/configure-aws-credentials@v4` with `role-to-assume: ${{ vars.AWS_DEPLOY_ROLE_ARN }}`. There are no `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` secrets in the repo. The role's trust policy federates the GitHub OIDC provider (`token.actions.githubusercontent.com`) scoped to this repo, and deploys are additionally gated on the `production` GitHub environment.

### First-time setup checklist

1. **AWS CLI credentials for the operator:** configure the profile that will run `scripts/deploy-stack.sh`.
2. **Deploy the backend:** run `scripts/deploy-stack.sh`, then smoke-test: `curl https://<api-id>.execute-api.us-east-1.amazonaws.com/prod/events` should return `[]`.
3. **Create the first Admin:**

   ```bash
   aws cognito-idp admin-create-user \
     --user-pool-id <UserPoolId> \
     --username admin@yourorg.com \
     --temporary-password 'Admin@1234' \
     --user-attributes Name=name,Value="Admin User"
   aws cognito-idp admin-add-user-to-group \
     --user-pool-id <UserPoolId> --username admin@yourorg.com --group-name Admin
   ```

   First sign-in at `/auth` prompts for a permanent password.

4. **Local frontend:** copy `.env.example` to `.env`, fill in the four `VITE_` values from the stack outputs, `bun run dev`, sign in at `/auth`.
5. **Amplify Hosting (already connected):** the app `event-with-me` is deployed by `deploy-frontend.yml` on pushes to `main`; the four `VITE_` values are set in that workflow's Build step. Point `AllowedOrigin` at the Amplify domain with `scripts/update-cors-origin.sh`.
6. **GitHub Actions OIDC (already configured):** the scoped deploy role's ARN is the `AWS_DEPLOY_ROLE_ARN` repo variable; its trust policy federates the GitHub OIDC provider for this repo, and both workflows gate deploys on the `production` environment. No IAM user or static keys are used anywhere.
7. **Email sender (one-time):** verify a sender identity in SES (`verify-domain-identity` for `azubisuccess.space`, or `verify-email-identity` for a mailbox) and confirm it shows `Success` in `aws ses get-identity-verification-attributes`. The pipeline itself is already wired: the topic, the `SendConfirmationEmail` Lambda, and the DLQ all come from the stacks.

---

## Cognito roles

| Group                 | Access                                                |
| --------------------- | ----------------------------------------------------- |
| `Admin`               | Full access - events, staff, reports, settings, audit |
| `RegistrationOfficer` | Walk-in registration, participants                    |
| `CheckinOfficer`      | Check-in, walk-in (limited)                           |

Enforcement lives in the handlers (`shared/auth.py`); the API Gateway Cognito authorizer rejects invalid/expired tokens first.

---

## Testing

```bash
backend/.venv/bin/python -m pytest tests -q   # or: python -m pytest backend/tests
```

19 pytest tests (`backend/tests/`) with faked DynamoDB tables via `conftest.py` helpers. Frontend gates: `bun run lint`, `npx tsc --noEmit`, `bun run build`.

---

## Badge printing

Badge is **100 mm × 60 mm landscape**. In Chrome's print dialog: paper 100×60 mm landscape, margins none, headers/footers off.

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
  deploy-stack.sh         zip + hash + upload + stack deploy
  update-cors-origin.sh   repoint AllowedOrigin

src/
  lib/               api-client.ts, auth/cognito-client.ts, hooks/use-auth.ts, ...
  routes/            TanStack file-based routes (see src/routes/README.md)
  components/        UI components

docs/
  screenshots/       12 UI screenshots
  architecture.png   diagram export (editable .drawio kept untracked locally)

.github/workflows/
  deploy-lambda-code.yml  CI: pytest → zip → update-function-code (OIDC deploy)
  deploy-frontend.yml     CI: lint/typecheck/build → Amplify (OIDC deploy)

amplify.yml               build config for Amplify console hosting (ZIP deploys bypass it)
.env.example              the four VITE_ values to copy into .env
```
