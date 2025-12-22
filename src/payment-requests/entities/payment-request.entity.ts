import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn, UpdateDateColumn, JoinColumn } from 'typeorm';
import { OrderEntity } from '../../orders/entities/order.entity';
import { UserEntity } from '../../users/entities/user.entity';
import { BillingEntity } from '../../billing/entities/billing.entity';

@Entity('payment_requests')
export class PaymentRequestEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  orderId: number;

  @ManyToOne(() => OrderEntity)
  order: OrderEntity;

  @Column({ nullable: true })
  billingId: number;

  @ManyToOne(() => BillingEntity)
  @JoinColumn({ name: 'billingId' })
  billing: BillingEntity;

  @Column({ nullable: true })
  distributorId: number;

  @ManyToOne(() => UserEntity)
  distributor: UserEntity;

  @Column('decimal', { precision: 12, scale: 2 })
  amount: number;

  @Column({ default: 'pending' })
  status: 'pending' | 'paid' | 'rejected';

  @Column({ nullable: true })
  reason?: string;

  // NEW FIELDS FOR PAYMENT LINKS & UPI
  @Column({ unique: true, nullable: true })
  paymentLink: string; // Unique token for payment

  @Column({ nullable: true })
  paymentLinkCustomer: string; // Unique link for customer invoice payment

  @Column({ nullable: true })
  paymentLinkDistributor: string; // Unique link for distributor vendor payment

  @Column({ type: 'timestamp', nullable: true })
  linkExpiresAt: Date; // Payment link expiration time

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  amountPaid: number; // Actual amount paid

  @Column({ default: 'pending' })
  upiStatus: 'pending' | 'processing' | 'success' | 'failed' | 'expired';

  @Column({ nullable: true })
  paymentMethod: 'upi' | 'netbanking' | 'card' | null;

  @Column({ nullable: true })
  razorpayOrderId: string; // Razorpay order ID for tracking

  @Column({ default: false })
  isAutoTriggered: boolean; // Whether this was auto-triggered or manual

  @Column({ nullable: true })
  purchaseOrderId: number; // Reference to Purchase Order

  @Column({ nullable: true })
  invoiceUrl: string; // URL to attached invoice

  @Column({ nullable: true })
  manualPaymentReferenceNo: string; // Reference number for manual payments

  @Column({ type: 'timestamp', nullable: true })
  manualPaymentDate: Date; // Date of manual payment

  @Column({ default: 'cash' })
  paymentType: 'cash' | 'online' | 'credit'; // Payment type: Cash, Online (Razorpay), or Credit

  @Column({ nullable: true })
  customerId: number; // Reference to customer for billing payments

  @Column({ nullable: true })
  razorpayLinkId: string; // Razorpay payment link ID

  @Column({ default: false })
  isOfflinePayment: boolean; // Whether this payment is offline

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
