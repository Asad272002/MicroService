import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('mock_hcm_balances')
@Index(['employeeId', 'locationId', 'leaveType'], { unique: true })
export class MockHcmBalance {
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

  @Column({ default: 1 })
  version!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
