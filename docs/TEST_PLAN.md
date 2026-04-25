# Test Plan

## Objectives
- Verify time-off lifecycle correctness
- Verify local balance reservation integrity
- Verify defensive handling when HCM changes independently or fails
- Verify REST validation and error codes

## Test Layers
### Unit Tests
Target:
- `src/time-off/time-off.domain.ts`
- `src/time-off/time-off.service.ts`

Coverage goals:
- Inclusive date range calculation
- Requested-day validation against date range
- Spendable balance calculation
- Reservation, release, and approval finalization math
- Status transition guards
- Invalid dimensions
- Insufficient local balance
- Stable HCM rejection handling on approval

### Integration / E2E Tests
Target:
- Full NestJS application booted with SQLite and real controllers

Scenarios:
- Health endpoint works
- Create valid request
- Create request with insufficient balance
- Approve request successfully
- Reject request and release reservation
- Cancel request and release reservation
- Invalid employee/location/leave type combination
- Double request scenario blocked by reservation
- HCM anniversary bonus mutates source-of-truth balance
- Batch sync updates local cache
- Stable HCM rejection during approval returns rejected request
- Transient HCM filing failure moves request to `NEEDS_REVIEW`
- Invalid date range payload returns `400`

## Determinism
- Each e2e test uses its own SQLite file
- Seed data is reloaded per test app instance
- HCM mock state is local to each test app

## Entry Criteria
- `npm install` completed successfully
- No external dependencies are required

## Exit Criteria
- `npm test` passes
- `npm run test:cov` passes
- No blocking diagnostics remain in edited files

## Manual Smoke Checks
- Run `npm run seed`
- Run `npm start`
- Call `GET /health`
- Create, approve, reject, and cancel requests with `curl`
- Simulate an HCM bonus and run `POST /sync/hcm/balances`

## Risks Not Fully Modeled
- True concurrent request races under multi-instance deployment
- Partial-day or holiday-aware calculations
- Long-running reconciliation workflows for `NEEDS_REVIEW`
