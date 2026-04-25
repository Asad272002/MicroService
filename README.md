# ExampleHR Time-Off Microservice

Scoped NestJS + SQLite prototype for a take-home backend exercise. The service manages employee time-off requests, keeps a local balance cache with reservations, and syncs against a mocked HCM that acts as the source of truth.

## Scope Note
- This repository is a scoped prototype for a take-home submission, not a production HR system.
- All records are fake seed data only.
- The HCM integration is a mock module only.
- There are no real employee records, real HCM credentials, or external services.
- Authentication, frontend, and production deployment concerns are intentionally out of scope.

## Overview
- Framework: NestJS
- Language: TypeScript
- Database: SQLite with TypeORM
- API style: REST
- Testing: Jest + Supertest
- HCM simulation: in-process mock module under `/mock-hcm`

## Submission Summary
- Implements a scoped ExampleHR time-off microservice with local balance caching plus mock-HCM source-of-truth validation
- Supports request creation, approval, rejection, cancellation, real-time HCM checks, and batch reconciliation
- Includes deterministic seed data, rigorous automated tests, and supporting design/test documents
- Verifies `npm run build`, `npm test`, and `npm run test:cov`

## Features
- Create time-off requests with request payload validation
- Validate requests against local reserved balance and mock HCM balance
- Reserve local balance for pending requests to prevent double spending
- Approve, reject, and cancel requests with balance reconciliation
- Defensively mark requests as `NEEDS_REVIEW` when HCM filing fails transiently
- Simulate HCM anniversary bonus and balance reset events
- Run batch balance sync from mock HCM into the local cache
- Accept HCM-style pushed balance corpora or fall back to mock-HCM pull behavior
- Seed deterministic demo data for local execution and testing

## Project Structure
```text
docs/
  COVERAGE_PROOF.md
  TEST_PLAN.md
  TRD.md
src/
  common/
  database/
  hcm-mock/
  sync/
  time-off/
  app.module.ts
  app.setup.ts
  health.controller.ts
  main.ts
  seed.ts
test/
  app.e2e-spec.ts
  test-app.ts
  time-off.domain.spec.ts
  time-off.service.spec.ts
data/
package.json
tsconfig.json
jest.config.ts
```

## Setup
```bash
npm install
```

## Database Setup
The app uses SQLite and creates `data/dev.sqlite` automatically on first run.

## Seed Data
```bash
npm run seed
```

Seeded balances:
- `EMP-100 / US-NY / PTO = 15`
- `EMP-100 / US-NY / SICK = 8`
- `EMP-200 / UK-LON / PTO = 20`
- `EMP-300 / DE-BER / PTO = 12`

## Run The App
```bash
npm run seed
npm start
```

Default URL: [http://localhost:3000](http://localhost:3000)

## Build Verification
```bash
npm run build
```

## Final Verification Snapshot
- Build: passes
- Tests: `48/48` passing
- Coverage Statements: `94.22%`
- Coverage Branches: `72.99%`
- Coverage Functions: `87.83%`
- Coverage Lines: `93.81%`

## Main Endpoints
- `GET /health`
- `GET /balances?employeeId=&locationId=`
- `GET /balances/:employeeId/:locationId/:leaveType`
- `POST /time-off-requests`
- `GET /time-off-requests`
- `GET /time-off-requests/:id`
- `POST /time-off-requests/:id/approve`
- `POST /time-off-requests/:id/reject`
- `POST /time-off-requests/:id/cancel`
- `POST /sync/hcm/balances`
- `GET /mock-hcm/balances?employeeId=&locationId=&leaveType=`
- `POST /mock-hcm/validate-time-off`
- `POST /mock-hcm/file-time-off`
- `POST /mock-hcm/batch-balances`
- `POST /mock-hcm/simulate-anniversary-bonus`
- `POST /mock-hcm/simulate-balance-reset`

## Tests
Run all tests:

```bash
npm test
```

Run coverage:

```bash
npm run test:cov
```

Coverage output is written to `coverage/`.

## Test Coverage Focus
- Happy-path request lifecycle
- Invalid payload validation and extra-field rejection
- Insufficient local balance and missing balance lookups
- HCM validation rejection and HCM validation unavailability
- HCM filing rejection and HCM filing unavailability leading to `NEEDS_REVIEW`
- Invalid state transitions for approve, reject, and cancel
- Batch sync introducing new balances and preserving local `reservedDays`
- Unit coverage for reservation math, sync behavior, and mock-HCM branches

## API Examples
Health check:

```bash
curl http://localhost:3000/health
```

List local balances for an employee/location:

```bash
curl "http://localhost:3000/balances?employeeId=EMP-100&locationId=US-NY"
```

Create a time-off request:

```bash
curl -X POST http://localhost:3000/time-off-requests \
  -H "Content-Type: application/json" \
  -d "{\"employeeId\":\"EMP-100\",\"locationId\":\"US-NY\",\"leaveType\":\"PTO\",\"startDate\":\"2026-04-10\",\"endDate\":\"2026-04-12\",\"requestedDays\":3}"
```

Approve a request:

```bash
curl -X POST http://localhost:3000/time-off-requests/<REQUEST_ID>/approve
```

Reject a request:

```bash
curl -X POST http://localhost:3000/time-off-requests/<REQUEST_ID>/reject \
  -H "Content-Type: application/json" \
  -d "{\"rejectionReason\":\"Manager denied overlap request.\"}"
```

Cancel a request:

```bash
curl -X POST http://localhost:3000/time-off-requests/<REQUEST_ID>/cancel
```

Read mock HCM balances:

```bash
curl "http://localhost:3000/mock-hcm/balances?employeeId=EMP-100&locationId=US-NY&leaveType=PTO"
```

Simulate HCM anniversary bonus:

```bash
curl -X POST http://localhost:3000/mock-hcm/simulate-anniversary-bonus \
  -H "Content-Type: application/json" \
  -d "{\"employeeId\":\"EMP-100\",\"locationId\":\"US-NY\",\"leaveType\":\"PTO\",\"bonusDays\":5}"
```

Trigger batch sync from mock HCM:

```bash
curl -X POST http://localhost:3000/sync/hcm/balances
```

Send a full HCM balance corpus to the sync endpoint:

```bash
curl -X POST http://localhost:3000/sync/hcm/balances \
  -H "Content-Type: application/json" \
  -d "{\"balances\":[{\"employeeId\":\"EMP-100\",\"locationId\":\"US-NY\",\"leaveType\":\"PTO\",\"availableDays\":15}]}"
```

## Assumptions
- HCM is the source of truth for available leave balances.
- Local balances are a cache plus reservation ledger for pending requests.
- `requestedDays` is provided explicitly and must not exceed the inclusive date range.
- Working-day calendars, holidays, and partial-day logic are out of scope.

## Design Notes
- Local `reservedDays` is used to prevent double spending while a request is pending.
- Approval is defensive: the service consults HCM again at filing time rather than trusting the cached balance alone.
- Batch sync updates `availableDays` from HCM but intentionally preserves `reservedDays`, because reservations represent ExampleHR workflow state.
- The sync endpoint accepts an inbound HCM corpus payload and also supports pull-style behavior when no payload is provided.

## Limitations
- No authentication or authorization
- No distributed locking or queue-based reconciliation
- No real Workday or SAP integration
- No holiday calendar or business-day computation
- SQLite `synchronize: true` is acceptable here because this is a local prototype

## Dependency Audit Note
- `npm audit` currently reports `9` vulnerabilities: `2 low`, `1 moderate`, and `6 high`.
- The reported high-severity items come from transitive chains under `sqlite3` and `typeorm`, specifically through `node-gyp`, `make-fetch-happen`, `tar`, and `uuid`.
- The available automated fix path is `npm audit fix --force`, which would require breaking dependency changes such as `sqlite3@6` or incompatible `typeorm` changes.
- Because this repository is a scoped prototype and the vulnerable packages are not being exposed as an internet-facing runtime feature set beyond local SQLite usage, the safer submission choice is to document the risk rather than force-upgrade blindly.

## Documentation
- TRD: [docs/TRD.md](docs/TRD.md)
- Test plan: [docs/TEST_PLAN.md](docs/TEST_PLAN.md)
- Coverage proof: [docs/COVERAGE_PROOF.md](docs/COVERAGE_PROOF.md)
