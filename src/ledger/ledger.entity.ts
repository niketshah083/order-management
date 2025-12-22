import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { UserEntity } from '../users/entities/user.entity';

@Entity('distributor_ledger')
export class DistributorLedgerEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'int' })
  distributorId: number;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'distributorId' })
  distributor: UserEntity;

  @Column({ type: 'varchar', length: 50 })
  transactionType: 'PURCHASE' | 'PAYMENT' | 'CREDIT_ADJUSTMENT' | 'REFUND' | 'OPENING_BALANCE';

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  referenceNo: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  referenceType: string;

  @Column({ type: 'int', nullable: true })
  referenceId: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  runningBalance: number;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
