import {
  assertStatusForApproval,
  calculateInclusiveDateRangeDays,
  finalizeApprovedDays,
  getSpendableDays,
  hasSufficientLocalBalance,
  releaseReservedDays,
  reserveDays,
  validateRequestedDaysWithinRange,
} from '../src/time-off/time-off.domain';
import { TimeOffRequestStatus } from '../src/time-off/time-off-request-status.enum';

describe('time-off.domain', () => {
  it('calculates inclusive date range days', () => {
    expect(calculateInclusiveDateRangeDays('2026-04-01', '2026-04-03')).toBe(3);
  });

  it('rejects requested days that exceed the date range', () => {
    expect(() =>
      validateRequestedDaysWithinRange('2026-04-01', '2026-04-03', 4),
    ).toThrow('Requested days cannot exceed the inclusive date range.');
  });

  it('computes spendable balance after reservations', () => {
    expect(getSpendableDays({ availableDays: 10, reservedDays: 3 })).toBe(7);
    expect(
      hasSufficientLocalBalance({ availableDays: 10, reservedDays: 3 }, 7),
    ).toBe(true);
    expect(
      hasSufficientLocalBalance({ availableDays: 10, reservedDays: 3 }, 8),
    ).toBe(false);
  });

  it('reserves, releases, and finalizes approved days', () => {
    const reserved = reserveDays({ reservedDays: 1, version: 2 }, 4);
    expect(reserved).toEqual({ reservedDays: 5, version: 3 });

    const released = releaseReservedDays({ reservedDays: 5, version: 3 }, 2);
    expect(released).toEqual({ reservedDays: 3, version: 4 });

    const finalized = finalizeApprovedDays(
      { availableDays: 15, reservedDays: 5, version: 4 },
      4,
    );
    expect(finalized).toEqual({
      availableDays: 11,
      reservedDays: 1,
      version: 5,
    });
  });

  it('enforces approval status transitions', () => {
    expect(() => assertStatusForApproval(TimeOffRequestStatus.PENDING)).not.toThrow();
    expect(() =>
      assertStatusForApproval(TimeOffRequestStatus.APPROVED),
    ).toThrow('Only pending or needs-review requests can be approved.');
  });
});
