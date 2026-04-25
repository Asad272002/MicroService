import request from 'supertest';

import { HcmMockService } from '../src/hcm-mock/hcm-mock.service';
import { TimeOffRequestStatus } from '../src/time-off/time-off-request-status.enum';
import { createTestApp, destroyTestApp } from './test-app';

jest.setTimeout(30000);

describe('ExampleHR Time-Off API (e2e)', () => {
  it('creates a valid request and reserves local balance', async () => {
    const { app, dbPath } = await createTestApp();

    try {
      const response = await request(app.getHttpServer())
        .post('/time-off-requests')
        .send({
          employeeId: 'EMP-100',
          locationId: 'US-NY',
          leaveType: 'PTO',
          startDate: '2026-04-10',
          endDate: '2026-04-12',
          requestedDays: 3,
        })
        .expect(201);

      expect(response.body.status).toBe(TimeOffRequestStatus.PENDING);

      const balanceResponse = await request(app.getHttpServer())
        .get('/balances/EMP-100/US-NY/PTO')
        .expect(200);

      expect(balanceResponse.body.availableDays).toBe(15);
      expect(balanceResponse.body.reservedDays).toBe(3);
    } finally {
      await destroyTestApp(app, dbPath);
    }
  });

  it('rejects creation when local balance is insufficient', async () => {
    const { app, dbPath } = await createTestApp();

    try {
      await request(app.getHttpServer())
        .post('/time-off-requests')
        .send({
          employeeId: 'EMP-100',
          locationId: 'US-NY',
          leaveType: 'PTO',
          startDate: '2026-04-10',
          endDate: '2026-04-30',
          requestedDays: 16,
        })
        .expect(409);
    } finally {
      await destroyTestApp(app, dbPath);
    }
  });

  it('approves a request successfully and commits balance reduction', async () => {
    const { app, dbPath } = await createTestApp();

    try {
      const createResponse = await request(app.getHttpServer())
        .post('/time-off-requests')
        .send({
          employeeId: 'EMP-100',
          locationId: 'US-NY',
          leaveType: 'PTO',
          startDate: '2026-04-10',
          endDate: '2026-04-11',
          requestedDays: 2,
        })
        .expect(201);

      const approveResponse = await request(app.getHttpServer())
        .post(`/time-off-requests/${createResponse.body.id}/approve`)
        .send({})
        .expect(201);

      expect(approveResponse.body.status).toBe(TimeOffRequestStatus.APPROVED);
      expect(approveResponse.body.hcmReferenceId).toContain('HCM-');

      const balanceResponse = await request(app.getHttpServer())
        .get('/balances/EMP-100/US-NY/PTO')
        .expect(200);

      expect(balanceResponse.body.availableDays).toBe(13);
      expect(balanceResponse.body.reservedDays).toBe(0);
    } finally {
      await destroyTestApp(app, dbPath);
    }
  });

  it('rejects a pending request and releases reserved balance', async () => {
    const { app, dbPath } = await createTestApp();

    try {
      const createResponse = await request(app.getHttpServer())
        .post('/time-off-requests')
        .send({
          employeeId: 'EMP-100',
          locationId: 'US-NY',
          leaveType: 'PTO',
          startDate: '2026-04-10',
          endDate: '2026-04-12',
          requestedDays: 3,
        })
        .expect(201);

      const rejectResponse = await request(app.getHttpServer())
        .post(`/time-off-requests/${createResponse.body.id}/reject`)
        .send({ rejectionReason: 'Manager denied overlap request.' })
        .expect(201);

      expect(rejectResponse.body.status).toBe(TimeOffRequestStatus.REJECTED);

      const balanceResponse = await request(app.getHttpServer())
        .get('/balances/EMP-100/US-NY/PTO')
        .expect(200);

      expect(balanceResponse.body.reservedDays).toBe(0);
      expect(balanceResponse.body.availableDays).toBe(15);
    } finally {
      await destroyTestApp(app, dbPath);
    }
  });

  it('cancels a pending request and releases reserved balance', async () => {
    const { app, dbPath } = await createTestApp();

    try {
      const createResponse = await request(app.getHttpServer())
        .post('/time-off-requests')
        .send({
          employeeId: 'EMP-100',
          locationId: 'US-NY',
          leaveType: 'PTO',
          startDate: '2026-04-10',
          endDate: '2026-04-11',
          requestedDays: 2,
        })
        .expect(201);

      const cancelResponse = await request(app.getHttpServer())
        .post(`/time-off-requests/${createResponse.body.id}/cancel`)
        .send({})
        .expect(201);

      expect(cancelResponse.body.status).toBe(TimeOffRequestStatus.CANCELLED);

      const balanceResponse = await request(app.getHttpServer())
        .get('/balances/EMP-100/US-NY/PTO')
        .expect(200);

      expect(balanceResponse.body.reservedDays).toBe(0);
    } finally {
      await destroyTestApp(app, dbPath);
    }
  });

  it('reflects HCM anniversary bonus after batch sync', async () => {
    const { app, dbPath } = await createTestApp();

    try {
      await request(app.getHttpServer())
        .post('/mock-hcm/simulate-anniversary-bonus')
        .send({
          employeeId: 'EMP-100',
          locationId: 'US-NY',
          leaveType: 'PTO',
          bonusDays: 5,
        })
        .expect(201);

      await request(app.getHttpServer()).post('/sync/hcm/balances').send({}).expect(201);

      const balanceResponse = await request(app.getHttpServer())
        .get('/balances/EMP-100/US-NY/PTO')
        .expect(200);

      expect(balanceResponse.body.availableDays).toBe(20);
    } finally {
      await destroyTestApp(app, dbPath);
    }
  });

  it('accepts an inbound batch sync payload and introduces a new balance combination', async () => {
    const { app, dbPath } = await createTestApp();

    try {
      await request(app.getHttpServer())
        .post('/sync/hcm/balances')
        .send({
          balances: [
            {
              employeeId: 'EMP-777',
              locationId: 'CA-TOR',
              leaveType: 'PTO',
              availableDays: 7,
            },
          ],
        })
        .expect(201);

      const balanceResponse = await request(app.getHttpServer())
        .get('/balances/EMP-777/CA-TOR/PTO')
        .expect(200);

      expect(balanceResponse.body.availableDays).toBe(7);
      expect(balanceResponse.body.reservedDays).toBe(0);
    } finally {
      await destroyTestApp(app, dbPath);
    }
  });

  it('preserves reserved days while syncing an updated available balance', async () => {
    const { app, dbPath } = await createTestApp();

    try {
      await request(app.getHttpServer())
        .post('/time-off-requests')
        .send({
          employeeId: 'EMP-100',
          locationId: 'US-NY',
          leaveType: 'PTO',
          startDate: '2026-04-10',
          endDate: '2026-04-11',
          requestedDays: 2,
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/sync/hcm/balances')
        .send({
          balances: [
            {
              employeeId: 'EMP-100',
              locationId: 'US-NY',
              leaveType: 'PTO',
              availableDays: 25,
            },
          ],
        })
        .expect(201);

      const balanceResponse = await request(app.getHttpServer())
        .get('/balances/EMP-100/US-NY/PTO')
        .expect(200);

      expect(balanceResponse.body.availableDays).toBe(25);
      expect(balanceResponse.body.reservedDays).toBe(2);
    } finally {
      await destroyTestApp(app, dbPath);
    }
  });

  it('returns 404 for an invalid employee, location, and leave type combination', async () => {
    const { app, dbPath } = await createTestApp();

    try {
      await request(app.getHttpServer())
        .post('/time-off-requests')
        .send({
          employeeId: 'EMP-999',
          locationId: 'NOPE',
          leaveType: 'PTO',
          startDate: '2026-04-10',
          endDate: '2026-04-11',
          requestedDays: 2,
        })
        .expect(404);
    } finally {
      await destroyTestApp(app, dbPath);
    }
  });

  it('returns 404 for a missing balance lookup', async () => {
    const { app, dbPath } = await createTestApp();

    try {
      await request(app.getHttpServer())
        .get('/balances/EMP-404/US-NY/PTO')
        .expect(404);
    } finally {
      await destroyTestApp(app, dbPath);
    }
  });

  it('blocks a second overlapping reservation because the first request reserved balance', async () => {
    const { app, dbPath } = await createTestApp();

    try {
      await request(app.getHttpServer())
        .post('/time-off-requests')
        .send({
          employeeId: 'EMP-300',
          locationId: 'DE-BER',
          leaveType: 'PTO',
          startDate: '2026-04-10',
          endDate: '2026-04-15',
          requestedDays: 6,
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/time-off-requests')
        .send({
          employeeId: 'EMP-300',
          locationId: 'DE-BER',
          leaveType: 'PTO',
          startDate: '2026-04-20',
          endDate: '2026-04-26',
          requestedDays: 7,
        })
        .expect(409);
    } finally {
      await destroyTestApp(app, dbPath);
    }
  });

  it('returns 503 when HCM validation is unavailable during request creation', async () => {
    const { app, dbPath } = await createTestApp();

    try {
      const hcmMockService = app.get(HcmMockService);
      hcmMockService.setValidationFailure(
        {
          employeeId: 'EMP-100',
          locationId: 'US-NY',
          leaveType: 'PTO',
        },
        'service_unavailable',
        1,
      );

      await request(app.getHttpServer())
        .post('/time-off-requests')
        .send({
          employeeId: 'EMP-100',
          locationId: 'US-NY',
          leaveType: 'PTO',
          startDate: '2026-04-10',
          endDate: '2026-04-11',
          requestedDays: 2,
        })
        .expect(503);
    } finally {
      await destroyTestApp(app, dbPath);
    }
  });

  it('returns 409 when HCM rejects validation during request creation', async () => {
    const { app, dbPath } = await createTestApp();

    try {
      const hcmMockService = app.get(HcmMockService);
      hcmMockService.setValidationFailure(
        {
          employeeId: 'EMP-100',
          locationId: 'US-NY',
          leaveType: 'PTO',
        },
        'reject',
        1,
      );

      await request(app.getHttpServer())
        .post('/time-off-requests')
        .send({
          employeeId: 'EMP-100',
          locationId: 'US-NY',
          leaveType: 'PTO',
          startDate: '2026-04-10',
          endDate: '2026-04-11',
          requestedDays: 2,
        })
        .expect(409);
    } finally {
      await destroyTestApp(app, dbPath);
    }
  });

  it('marks a request rejected when HCM filing returns a stable rejection', async () => {
    const { app, dbPath } = await createTestApp();

    try {
      const createResponse = await request(app.getHttpServer())
        .post('/time-off-requests')
        .send({
          employeeId: 'EMP-100',
          locationId: 'US-NY',
          leaveType: 'PTO',
          startDate: '2026-04-10',
          endDate: '2026-04-12',
          requestedDays: 3,
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/mock-hcm/simulate-balance-reset')
        .send({
          employeeId: 'EMP-100',
          locationId: 'US-NY',
          leaveType: 'PTO',
          availableDays: 0,
        })
        .expect(201);

      const approveResponse = await request(app.getHttpServer())
        .post(`/time-off-requests/${createResponse.body.id}/approve`)
        .send({})
        .expect(201);

      expect(approveResponse.body.status).toBe(TimeOffRequestStatus.REJECTED);

      const balanceResponse = await request(app.getHttpServer())
        .get('/balances/EMP-100/US-NY/PTO')
        .expect(200);

      expect(balanceResponse.body.reservedDays).toBe(0);
      expect(balanceResponse.body.availableDays).toBe(15);
    } finally {
      await destroyTestApp(app, dbPath);
    }
  });

  it('moves a request to NEEDS_REVIEW when HCM filing fails transiently', async () => {
    const { app, dbPath } = await createTestApp();

    try {
      const createResponse = await request(app.getHttpServer())
        .post('/time-off-requests')
        .send({
          employeeId: 'EMP-100',
          locationId: 'US-NY',
          leaveType: 'PTO',
          startDate: '2026-04-10',
          endDate: '2026-04-11',
          requestedDays: 2,
        })
        .expect(201);

      const hcmMockService = app.get(HcmMockService);
      hcmMockService.setFilingFailure(
        {
          employeeId: 'EMP-100',
          locationId: 'US-NY',
          leaveType: 'PTO',
        },
        'service_unavailable',
        1,
      );

      await request(app.getHttpServer())
        .post(`/time-off-requests/${createResponse.body.id}/approve`)
        .send({})
        .expect(502);

      const requestResponse = await request(app.getHttpServer())
        .get(`/time-off-requests/${createResponse.body.id}`)
        .expect(200);

      expect(requestResponse.body.status).toBe(TimeOffRequestStatus.NEEDS_REVIEW);

      const balanceResponse = await request(app.getHttpServer())
        .get('/balances/EMP-100/US-NY/PTO')
        .expect(200);

      expect(balanceResponse.body.reservedDays).toBe(2);
    } finally {
      await destroyTestApp(app, dbPath);
    }
  });

  it('blocks approval of a rejected request', async () => {
    const { app, dbPath } = await createTestApp();

    try {
      const createResponse = await request(app.getHttpServer())
        .post('/time-off-requests')
        .send({
          employeeId: 'EMP-100',
          locationId: 'US-NY',
          leaveType: 'PTO',
          startDate: '2026-04-10',
          endDate: '2026-04-11',
          requestedDays: 2,
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/time-off-requests/${createResponse.body.id}/reject`)
        .send({ rejectionReason: 'Team coverage issue' })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/time-off-requests/${createResponse.body.id}/approve`)
        .send({})
        .expect(409);
    } finally {
      await destroyTestApp(app, dbPath);
    }
  });

  it('blocks approval of a cancelled request', async () => {
    const { app, dbPath } = await createTestApp();

    try {
      const createResponse = await request(app.getHttpServer())
        .post('/time-off-requests')
        .send({
          employeeId: 'EMP-100',
          locationId: 'US-NY',
          leaveType: 'PTO',
          startDate: '2026-04-10',
          endDate: '2026-04-11',
          requestedDays: 2,
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/time-off-requests/${createResponse.body.id}/cancel`)
        .send({})
        .expect(201);

      await request(app.getHttpServer())
        .post(`/time-off-requests/${createResponse.body.id}/approve`)
        .send({})
        .expect(409);
    } finally {
      await destroyTestApp(app, dbPath);
    }
  });

  it('blocks rejection of an approved request', async () => {
    const { app, dbPath } = await createTestApp();

    try {
      const createResponse = await request(app.getHttpServer())
        .post('/time-off-requests')
        .send({
          employeeId: 'EMP-100',
          locationId: 'US-NY',
          leaveType: 'PTO',
          startDate: '2026-04-10',
          endDate: '2026-04-11',
          requestedDays: 2,
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/time-off-requests/${createResponse.body.id}/approve`)
        .send({})
        .expect(201);

      await request(app.getHttpServer())
        .post(`/time-off-requests/${createResponse.body.id}/reject`)
        .send({ rejectionReason: 'Team coverage issue' })
        .expect(409);
    } finally {
      await destroyTestApp(app, dbPath);
    }
  });

  it('blocks cancellation of an approved request', async () => {
    const { app, dbPath } = await createTestApp();

    try {
      const createResponse = await request(app.getHttpServer())
        .post('/time-off-requests')
        .send({
          employeeId: 'EMP-100',
          locationId: 'US-NY',
          leaveType: 'PTO',
          startDate: '2026-04-10',
          endDate: '2026-04-11',
          requestedDays: 2,
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/time-off-requests/${createResponse.body.id}/approve`)
        .send({})
        .expect(201);

      await request(app.getHttpServer())
        .post(`/time-off-requests/${createResponse.body.id}/cancel`)
        .send({})
        .expect(409);
    } finally {
      await destroyTestApp(app, dbPath);
    }
  });

  it.each([
    [{ locationId: 'US-NY', leaveType: 'PTO' }, 'employeeId'],
    [{ employeeId: 'EMP-100', leaveType: 'PTO' }, 'locationId'],
    [{ employeeId: 'EMP-100', locationId: 'US-NY' }, 'leaveType'],
  ])(
    'returns 400 when required payload field %s is missing',
    async (partialPayload, _missingFieldName) => {
      const { app, dbPath } = await createTestApp();

      try {
        await request(app.getHttpServer())
          .post('/time-off-requests')
          .send({
            ...partialPayload,
            startDate: '2026-04-10',
            endDate: '2026-04-11',
            requestedDays: 1,
          })
          .expect(400);
      } finally {
        await destroyTestApp(app, dbPath);
      }
    },
  );

  it('returns 400 when extra payload fields are provided', async () => {
    const { app, dbPath } = await createTestApp();

    try {
      await request(app.getHttpServer())
        .post('/time-off-requests')
        .send({
          employeeId: 'EMP-100',
          locationId: 'US-NY',
          leaveType: 'PTO',
          startDate: '2026-04-10',
          endDate: '2026-04-11',
          requestedDays: 1,
          unexpectedField: 'not-allowed',
        })
        .expect(400);
    } finally {
      await destroyTestApp(app, dbPath);
    }
  });

  it.each([0, -1])(
    'returns 400 when requestedDays is %p',
    async (requestedDays) => {
      const { app, dbPath } = await createTestApp();

      try {
        await request(app.getHttpServer())
          .post('/time-off-requests')
          .send({
            employeeId: 'EMP-100',
            locationId: 'US-NY',
            leaveType: 'PTO',
            startDate: '2026-04-10',
            endDate: '2026-04-11',
            requestedDays,
          })
          .expect(400);
      } finally {
        await destroyTestApp(app, dbPath);
      }
    },
  );

  it('returns 400 for invalid date range payloads', async () => {
    const { app, dbPath } = await createTestApp();

    try {
      await request(app.getHttpServer())
        .post('/time-off-requests')
        .send({
          employeeId: 'EMP-100',
          locationId: 'US-NY',
          leaveType: 'PTO',
          startDate: '2026-04-10',
          endDate: '2026-04-12',
          requestedDays: 4,
        })
        .expect(400);
    } finally {
      await destroyTestApp(app, dbPath);
    }
  });
});
