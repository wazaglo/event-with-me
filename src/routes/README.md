# Routes

TanStack Start **file-based routing**: every `.tsx` here defines a route (the
route tree in `routeTree.gen.ts` is auto-generated - don't edit it). The only
root layout is `__root.tsx` (QueryClient provider, error boundary, toaster).
This is not Next.js: no `src/pages/`, no `app/layout.tsx`.

## Actual routes

| File                              | URL                      | Who can reach it                                                                                     |
| --------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------- |
| `index.tsx`                       | `/`                      | public landing page (event hero, links to register/login)                                            |
| `auth.tsx`                        | `/auth`                  | staff sign-in / forgot password / new password                                                       |
| `reset-password.tsx`              | `/reset-password`        | Cognito confirmation-code flow                                                                       |
| `register.tsx`                    | `/register`              | public portal wrapper                                                                                |
| `register.index.tsx`              | `/register/`             | public event list + registration form                                                                |
| `register.success.$reg.tsx`       | `/register/success/$reg` | confirmation page for a registration number                                                          |
| `_authenticated.tsx`              | (pathless layout)        | route guard: no session → redirect to `/auth`; renders app shell around all `_authenticated.*` pages |
| `_authenticated.dashboard`        | `/dashboard`             | live stats + recent activity                                                                         |
| `_authenticated.events`           | `/events`                | event CRUD (Admin creates/edits/deletes)                                                             |
| `_authenticated.participants`     | `/participants`          | roster, search, CSV-ready list                                                                       |
| `_authenticated.participants.$id` | `/participants/$id`      | attendee detail + edit                                                                               |
| `_authenticated.check-in`         | `/check-in`              | check-in scanner/list (CheckinOfficer)                                                               |
| `_authenticated.walk-in`          | `/walk-in`               | on-site registration (RegistrationOfficer)                                                           |
| `_authenticated.reports`          | `/reports`               | attendance stats                                                                                     |
| `_authenticated.audit`            | `/audit`                 | audit log (Admin)                                                                                    |
| `_authenticated.settings`         | `/settings`              | event configuration: details, branding, badge layout                                                 |
| `_authenticated.staff`            | `/staff`                 | stub: points at the Cognito console (in-app staff mgmt planned)                                      |
| `_authenticated.badge.$id`        | `/badge/$id`             | printable 100×60 mm badge (print stylesheet)                                                         |

Role gating inside `_authenticated/*` uses the `isAdmin` / `isRegOfficer` /
`isCheckinOfficer` booleans from `src/lib/hooks/use-auth.ts`; the API enforces
the real rules regardless of what the UI shows.

## Conventions worth keeping

- Dynamic segments are bare `$` (`$id`, `$reg`), never `{id}`.
- `_authenticated.tsx` is a **pathless layout**: children render under its
  guard + shell without their URL gaining a prefix beyond the underscore rule.
- Data fetching goes through `src/lib/api-client.ts` + TanStack Query, never
  ad-hoc `fetch`.
