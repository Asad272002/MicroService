import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class SyncBalanceRecordDto {
  @IsString()
  employeeId!: string;

  @IsString()
  locationId!: string;

  @IsString()
  leaveType!: string;

  @IsNumber()
  @Min(0)
  availableDays!: number;
}

export class SyncBalancesDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncBalanceRecordDto)
  balances?: SyncBalanceRecordDto[];
}
