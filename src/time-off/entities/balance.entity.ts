import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('balances')
@Index(['employeeId', 'locationId', 'leaveType'], { unique: true })
export class Balance {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  employeeId!: string;

  @Column()
  locationId!: string;

  @Column()
  leaveType!: string;

  @Column('float')
  availableDays!: number;

  @Column('float', { default: 0 })
  reservedDays!: number;

  @Column({ default: 1 })
  version!: number;

  @Column({ type: 'datetime' })
  lastSyncedAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
