import { TimeOffRequestStatus } from './time-off-request-status.enum';

export function calculateInclusiveDateRangeDays(
  startDate: string,
  endDate: string,
): number {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const startUtc = Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    start.getUTCDate(),
  );
  const endUtc = Date.UTC(
    end.getUTCFullYear(),
    end.getUTCMonth(),
    end.getUTCDate(),
  );

  return Math.floor((endUtc - startUtc) / 86400000) + 1;
}

export function validateRequestedDaysWithinRange(
  startDate: string,
  endDate: string,
  requestedDays: number,
): number {
  const rangeDays = calculateInclusiveDateRangeDays(startDate, endDate);

  if (rangeDays <= 0) {
    throw new Error('End date must be on or after start date.');
  }

  if (requestedDays > rangeDays) {
    throw new Error('Requested days cannot exceed the inclusive date range.');
  }

  return rangeDays;
}

export function getSpendableDays(balance: {
  availableDays: number;
  reservedDays: number;
}): number {
  return balance.availableDays - balance.reservedDays;
}

export function hasSufficientLocalBalance(
  balance: { availableDays: number; reservedDays: number },
  requestedDays: number,
): boolean {
  return getSpendableDays(balance) >= requestedDays;
}

export function reserveDays<T extends { reservedDays: number; version: number }>(
  balance: T,
  requestedDays: number,
): T {
  return {
    ...balance,
    reservedDays: balance.reservedDays + requestedDays,
    version: balance.version + 1,
  };
}

export function releaseReservedDays<
  T extends { reservedDays: number; version: number },
>(balance: T, requestedDays: number): T {
  return {
    ...balance,
    reservedDays: Math.max(0, balance.reservedDays - requestedDays),
    version: balance.version + 1,
  };
}

export function finalizeApprovedDays<
  T extends { availableDays: number; reservedDays: number; version: number },
>(balance: T, requestedDays: number): T {
  return {
    ...balance,
    availableDays: balance.availableDays - requestedDays,
    reservedDays: Math.max(0, balance.reservedDays - requestedDays),
    version: balance.version + 1,
  };
}

export function assertStatusForApproval(status: TimeOffRequestStatus): void {
  if (
    status !== TimeOffRequestStatus.PENDING &&
    status !== TimeOffRequestStatus.NEEDS_REVIEW
  ) {
    throw new Error('Only pending or needs-review requests can be approved.');
  }
}

export function assertStatusForRejection(status: TimeOffRequestStatus): void {
  if (
    status !== TimeOffRequestStatus.PENDING &&
    status !== TimeOffRequestStatus.NEEDS_REVIEW
  ) {
    throw new Error('Only pending or needs-review requests can be rejected.');
  }
}

export function assertStatusForCancellation(status: TimeOffRequestStatus): void {
  if (
    status !== TimeOffRequestStatus.PENDING &&
    status !== TimeOffRequestStatus.NEEDS_REVIEW
  ) {
    throw new Error('Only pending or needs-review requests can be cancelled.');
  }
}
