# Technical Requirement Document: Time-Off Microservice

## Executive Summary
This document describes a scoped prototype for ExampleHR's Time-Off Microservice. Employees submit time-off requests through ExampleHR, while the mocked HCM remains the balance source of truth. The service uses a local cache for responsive reads and pending-request reservations, but validates defensively against the HCM before creating or approving requests.

## Problem Statement
ExampleHR needs to support time-off requests even though official leave balances live in an external HCM. Balance drift can happen because HCM balances change independently through resets, bonuses, HR corrections, or other external workflows. The service must keep balance integrity, avoid double spending, and surface uncertainty safely when HCM behavior is unreliable.

## Product And User Needs
Employee needs:
- See a local view of balance quickly
- Submit a request and get immediate validation feedback
- Avoid over-requesting against already reserved balance

Manager needs:
- Review pending requests
- Approve or reject with confidence
- Understand when a request needs manual review because HCM failed mid-flow

## Goals
- Manage request lifecycle from creation through approval, rejection, and cancellation
- Maintain a local cached balance per `employeeId + locationId + leaveType`
- Reserve balance for pending requests
- Validate against both local cache and HCM
- Support real-time HCM validation and filing simulation
- Support batch HCM balance sync simulation
- Provide strong automated test coverage with clear documentation

## Non-Goals
- Authentication and authorization
- Frontend or admin UI
- Real Workday or SAP integration
- Queues, Kafka, Redis, or background workers
- Holiday calendar calculations
- Payroll or accrual engines
- Production deployment automation

## Assumptions
- HCM is the source of truth for leave balances
- Local balances are cache records with reservation tracking
- `requestedDays` is supplied explicitly and must not exceed the inclusive date range
- Pending requests consume reserved balance locally
- Approval attempts to commit the request to HCM
- Stable HCM rejection should reject the request; unstable HCM failure should move it to `NEEDS_REVIEW`

## Architecture Overview
The prototype is a single NestJS app with separate modules for business service logic, mock HCM behavior, and sync orchestration.

Modules:
- `TimeOffModule`: request lifecycle and local balance reservation integrity
- `HcmMockModule`: mocked HCM API endpoints and HCM-side balance state
- `SyncModule`: batch import/reconciliation from mock HCM into the local cache

Storage:
- SQLite via TypeORM
- One local balance table
- One request table
- One mock HCM balance table

## Data Model
### Balance
Fields:
- `id`
- `employeeId`
- `locationId`
- `leaveType`
- `availableDays`
- `reservedDays`
- `version`
- `lastSyncedAt`
- `createdAt`
- `updatedAt`

Unique key:
- `employeeId + locationId + leaveType`

### TimeOffRequest
Fields:
- `id`
- `employeeId`
- `locationId`
- `leaveType`
- `startDate`
- `endDate`
- `requestedDays`
- `status`
- `hcmReferenceId`
- `rejectionReason`
- `createdAt`
- `updatedAt`

Statuses:
- `PENDING`
- `APPROVED`
- `REJECTED`
- `CANCELLED`
- `NEEDS_REVIEW`

### MockHcmBalance
Fields:
- `id`
- `employeeId`
- `locationId`
- `leaveType`
- `availableDays`
- `version`
- `createdAt`
- `updatedAt`

## API Design
Service endpoints:
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

Mock HCM endpoints:
- `GET /mock-hcm/balances?employeeId=&locationId=&leaveType=`
- `POST /mock-hcm/validate-time-off`
- `POST /mock-hcm/file-time-off`
- `POST /mock-hcm/batch-balances`
- `POST /mock-hcm/simulate-anniversary-bonus`
- `POST /mock-hcm/simulate-balance-reset`

## Request Lifecycle
### Create
1. Validate payload shape and date range
2. Read local cached balance
3. Ensure `availableDays - reservedDays >= requestedDays`
4. Validate against mock HCM real-time balance
5. Persist request as `PENDING`
6. Increase `reservedDays`

### Approve
1. Ensure request is in `PENDING` or `NEEDS_REVIEW`
2. Call HCM filing endpoint
3. If HCM returns stable rejection, mark request `REJECTED` and release reservation
4. If HCM accepts, mark request `APPROVED`, reduce local `availableDays`, and clear reservation
5. If HCM fails transiently, mark request `NEEDS_REVIEW` and preserve reservation for manual follow-up

### Reject
1. Ensure request is in `PENDING` or `NEEDS_REVIEW`
2. Mark request `REJECTED`
3. Release reserved days

### Cancel
1. Ensure request is in `PENDING` or `NEEDS_REVIEW`
2. Mark request `CANCELLED`
3. Release reserved days

## Sync Strategy
- Mock HCM exposes the full current balance snapshot
- `POST /sync/hcm/balances` fetches the HCM snapshot and reconciles the local cache
- Existing local records update `availableDays`, `version`, and `lastSyncedAt`
- `reservedDays` stays local because it reflects ExampleHR workflow state
- Missing local dimensions found in HCM are inserted as new local cache rows

## Defensive Consistency Strategy
- Local cache blocks obvious overspend quickly
- HCM validation is checked before request creation
- Reservations prevent double spending from concurrent pending requests
- HCM is re-consulted on approval through filing
- Stable HCM rejection rejects the request cleanly
- Unstable HCM transport failure moves the request to `NEEDS_REVIEW`

## HCM Mock Design
- HCM balances are stored in SQLite for deterministic testability
- Mock endpoints support real-time validation and filing behavior
- Simulation endpoints mutate HCM state independently from ExampleHR
- Tests can also toggle transient HCM failures through service methods

## Error Handling
Response shape:
- `statusCode`
- `error`
- `message`
- `details`
- `timestamp`
- `path`

Status code guidance:
- `400` invalid payload or invalid date range
- `404` missing request or balance
- `409` insufficient balance or invalid state transition
- `502` HCM filing failure before a stable response
- `503` HCM validation unavailable

## Testing Strategy
- Unit tests cover date-range validation, spendable balance logic, reservation/release logic, and transition rules
- Service-level unit tests cover invalid dimensions, insufficient local balance, and stable HCM filing rejection handling
- E2E tests cover happy paths plus defensive scenarios including double reservation, batch sync, independent HCM mutations, stable HCM rejection, and transient HCM failure to `NEEDS_REVIEW`

## Alternatives Considered
- Prisma instead of TypeORM: rejected to stay closer to the preferred stack and keep SQLite setup simple
- Separate HCM mock service process: rejected because the assignment explicitly allows mocking in the same Nest app
- Queue-based reconciliation: rejected as out of scope for a prototype

## Production Considerations
- Add authentication and authorization
- Add idempotency keys for approval operations
- Replace `synchronize: true` with migrations
- Use stronger concurrency controls around reservation updates
- Add observability, retries, circuit breaking, and dead-letter handling for HCM communication
- Move sync and reconciliation to scheduled/background jobs

## Limitations
- Inclusive date ranges are validated, but business-day calendars are not modeled
- No partial-day support
- No multi-tenant separation
- Manual review handling is stateful but not workflow-driven beyond the status field
