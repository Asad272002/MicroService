# Coverage Proof

Use this file to capture the coverage evidence submitted with the exercise.

## Command
```bash
npm run test:cov
```

## Execution Date
- `2026-04-25`

## Environment
- Node version: `v22.19.0`
- npm version: `10.9.3`
- OS: `Windows`

## Result Summary
- Statements: `94.22%`
- Branches: `72.99%`
- Functions: `87.83%`
- Lines: `93.81%`

## Notes
- Coverage was generated with the final hardening-pass test suite.
- Remaining uncovered paths are mostly low-risk controller passthroughs and a few defensive branches that are not critical to the scoped prototype.

## Sample Capture Block
```text
------------------------------------|---------|----------|---------|---------|-----------------------------------------------
File                                | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
------------------------------------|---------|----------|---------|---------|-----------------------------------------------
All files                           |   94.22 |    72.99 |   87.83 |   93.81 |
 src                                |   95.45 |      100 |      50 |   94.44 |
  app.module.ts                     |     100 |      100 |     100 |     100 |
  app.setup.ts                      |     100 |      100 |     100 |     100 |
  health.controller.ts              |   83.33 |      100 |       0 |      75 | 7
 src/common                         |   94.73 |       60 |     100 |   94.11 |
  global-http-exception.filter.ts   |   94.73 |       60 |     100 |   94.11 | 30
 src/database                       |     100 |      100 |     100 |     100 |
  database.config.ts                |     100 |      100 |     100 |     100 |
  seed-data.ts                      |     100 |      100 |     100 |     100 |
  seed-database.ts                  |     100 |      100 |     100 |     100 |
 src/hcm-mock                       |   93.06 |       75 |   80.95 |   92.63 |
  hcm-mock.controller.ts            |   80.95 |      100 |   42.85 |   78.94 | 18,23,28,33
  hcm-mock.module.ts                |     100 |      100 |     100 |     100 |
  hcm-mock.service.ts               |   95.83 |       75 |     100 |   95.71 | 97,181,231
 src/hcm-mock/dto                   |     100 |      100 |     100 |     100 |
  simulate-anniversary-bonus.dto.ts |     100 |      100 |     100 |     100 |
  simulate-balance-reset.dto.ts     |     100 |      100 |     100 |     100 |
 src/hcm-mock/entities              |     100 |      100 |     100 |     100 |
  mock-hcm-balance.entity.ts        |     100 |      100 |     100 |     100 |
 src/sync                           |     100 |    85.71 |     100 |     100 |
  sync.controller.ts                |     100 |        0 |     100 |     100 | 11
  sync.module.ts                    |     100 |      100 |     100 |     100 |
  sync.service.ts                   |     100 |      100 |     100 |     100 |
 src/sync/dto                       |     100 |      100 |     100 |     100 |
  sync-balances.dto.ts              |     100 |      100 |     100 |     100 |
 src/time-off                       |    90.4 |     72.5 |   89.47 |    90.1 |
  time-off-request-status.enum.ts   |     100 |      100 |     100 |     100 |
  time-off.controller.ts            |   91.66 |      100 |   77.77 |    90.9 | 16,35
  time-off.domain.ts                |   96.96 |    93.75 |     100 |   96.96 | 32
  time-off.module.ts                |     100 |      100 |     100 |     100 |
  time-off.service.ts               |    87.2 |    66.12 |   88.88 |   86.99 | 44-58,140,147,168,198,212,266,305,347,377,405
 src/time-off/dto                   |     100 |      100 |     100 |     100 |
  create-time-off-request.dto.ts    |     100 |      100 |     100 |     100 |
  reject-time-off-request.dto.ts    |     100 |      100 |     100 |     100 |
 src/time-off/entities              |     100 |      100 |     100 |     100 |
  balance.entity.ts                 |     100 |      100 |     100 |     100 |
  time-off-request.entity.ts        |     100 |      100 |     100 |     100 |
------------------------------------|---------|----------|---------|---------|-----------------------------------------------
```
