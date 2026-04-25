import { IsDateString, IsNumber, IsPositive, IsString } from 'class-validator';

export class CreateTimeOffRequestDto {
  @IsString()
  employeeId!: string;

  @IsString()
  locationId!: string;

  @IsString()
  leaveType!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsNumber()
  @IsPositive()
  requestedDays!: number;
}
