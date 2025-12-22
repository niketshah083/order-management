import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { UserEntity } from 'src/users/entities/user.entity';

@Entity('distributor_payment_entries')
export class DistributorPaymentEntryEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'int' })
  distributorId: number;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'distributorId' })
  distributor: UserEntity;

  @Column({ type: 'date' })
  paymentDate: Date;

  @Column({ type: 'varchar', length: 50 })
  paymentMode: 'CASH' | 'CHEQUE' | 'BANK_TRANSFER' | 'UPI' | 'NEFT' | 'OTHER';

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  chequeNo: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  referenceNo: string;

  @Column({ type: 'varchar', nullable: true })
  attachmentUrl: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 50, default: 'PENDING' })
  status: 'PENDING' | 'APPROVED' | 'REJECTED';

  @Column({ type: 'text', nullable: true })
  adminRemarks: string;

  @Column({ type: 'int', nullable: true })
  approvedBy: number;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'approvedBy' })
  approverUser: UserEntity;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date;
}
