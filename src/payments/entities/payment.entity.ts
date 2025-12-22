import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BillingEntity } from '../../billing/entities/billing.entity';

@Entity('payments')
@Index(['billingId'])
@Index(['razorpayPaymentId'])
@Index(['status'])
export class PaymentEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  billingId: number;

  @ManyToOne(() => BillingEntity)
  @JoinColumn({ name: 'billingId' })
  billing: BillingEntity;

  @Column({ nullable: true })
  distributorId: number;

  @Column('decimal', { precision: 12, scale: 2 })
  amount: number;

  @Column({ default: 'INR' })
  currency: string;

  @Column({ unique: true })
  razorpayOrderId: string;

  @Column({ nullable: true })
  razorpayPaymentId: string;

  @Column({ nullable: true })
  razorpaySignature: string;

  @Column({
    type: 'enum',
    enum: ['created', 'authorized', 'captured', 'failed', 'refunded'],
    default: 'created',
  })
  status: 'created' | 'authorized' | 'captured' | 'failed' | 'refunded';

  @Column({ nullable: true })
  paymentMethod: string;

  @Column({ nullable: true })
  bank: string;

  @Column({ nullable: true })
  wallet: string;

  @Column({ nullable: true })
  vpa: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  contact: string;

  @Column({ type: 'text', nullable: true })
  errorCode: string;

  @Column({ type: 'text', nullable: true })
  errorDescription: string;

  @Column({ type: 'json', nullable: true })
  metadata: any;

  @Column({ nullable: true })
  refundId: string;

  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  refundAmount: number;

  @Column({ nullable: true })
  refundedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
