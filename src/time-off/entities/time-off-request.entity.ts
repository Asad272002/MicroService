import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { TimeOffRequestStatus } from '../time-off-request-status.enum';

@Entity('time_off_requests')
export class TimeOffRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  employeeId!: string;

  @Column()
  locationId!: string;

  @Column()
  leaveType!: string;

  @Column({ type: 'date' })
  startDate!: string;

  @Column({ type: 'date' })
  endDate!: string;

  @Column('float')
  requestedDays!: number;

  @Column({
    type: 'varchar',
    default: TimeOffRequestStatus.PENDING,
  })
  status!: TimeOffRequestStatus;

  @Column({ type: 'varchar', nullable: true })
  hcmReferenceId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  rejectionReason!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
