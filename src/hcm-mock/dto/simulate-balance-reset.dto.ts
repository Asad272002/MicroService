import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class SimulateBalanceResetDto {
  @IsString()
  employeeId!: string;

  @IsString()
  locationId!: string;

  @IsString()
  leaveType!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  availableDays?: number;
}
