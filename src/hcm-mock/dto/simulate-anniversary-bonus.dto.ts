import { IsNumber, IsPositive, IsString } from 'class-validator';

export class SimulateAnniversaryBonusDto {
  @IsString()
  employeeId!: string;

  @IsString()
  locationId!: string;

  @IsString()
  leaveType!: string;

  @IsNumber()
  @IsPositive()
  bonusDays!: number;
}
