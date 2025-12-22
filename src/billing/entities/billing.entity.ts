import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, OneToMany, Index } from 'typeorm';
import { CustomerEntity } from '../../customers/entities/customer.entity';
import { UserEntity } from '../../users/entities/user.entity';
import { BillingItemEntity } from './billing-item.entity';

@Entity('billings')
@Index(['customerId'])
@Index(['distributorId'])
@Index(['status'])
@Index(['billDate'])
export class BillingEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, nullable: true })
  billNo: string;

  @Column('date')
  billDate: string;

  @Column()
  customerId: number;

  @ManyToOne(() => CustomerEntity)
  @JoinColumn({ name: 'customerId', referencedColumnName: 'id' })
  customer: CustomerEntity;

  @Column({ nullable: true })
  distributorId: number;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'distributorId' })
  distributor: UserEntity;

  @OneToMany(() => BillingItemEntity, (item) => item.billing, { cascade: true })
  billingItems: BillingItemEntity[];

  @Column('decimal', { precision: 12, scale: 2 })
  subtotal: number;

  @Column('decimal', { precision: 12, scale: 2 })
  overallDiscount: number;

  @Column({ default: 'percentage' })
  overallDiscountType: 'percentage' | 'amount';

  @Column('decimal', { precision: 12, scale: 2 })
  totalAfterDiscount: number;

  @Column('decimal', { precision: 12, scale: 2 })
  cgstTotal: number;

  @Column('decimal', { precision: 12, scale: 2 })
  sgstTotal: number;

  @Column('decimal', { precision: 12, scale: 2 })
  igstTotal: number;

  @Column('decimal', { precision: 12, scale: 2 })
  grandTotal: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  roundOff: number;

  @Column('decimal', { precision: 12, scale: 2 })
  finalAmount: number;

  @Column({ nullable: true })
  notes: string;

  @Column({ default: 'draft' })
  status: 'draft' | 'approved' | 'completed';

  @Column({ default: 'draft' })
  approvalStatus: 'draft' | 'approved';

  @Column({ nullable: true })
  approvedAt: Date;

  @Column({ nullable: true })
  approvedBy: number;

  @Column({ nullable: true })
  completedAt: Date;

  @Column({ nullable: true })
  invoiceNo: string;

  @Column({ nullable: true })
  invoiceDate: string;

  @Column({ nullable: true })
  dueDate: string;

  @Column({ nullable: true })
  poNumber: string;

  @Column({ default: 'pending' })
  paymentStatus: 'pending' | 'partial' | 'completed';

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  amountPaid: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  amountDue: number;

  @Column({ type: 'varchar', default: 'cash' })
  paymentType: 'cash' | 'online' | 'credit';

  @Column({ nullable: true })
  cropName: string;

  @Column({ nullable: true })
  cropDiseases: string;

  @Column({ type: 'int', nullable: true })
  createdBy: number;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'createdBy' })
  createdByUser: UserEntity;

  @Column({ type: 'int', nullable: true })
  updatedBy: number;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'updatedBy' })
  updatedByUser: UserEntity;

  @Column({ type: 'varchar', nullable: true })
  createdByIp: string;

  @Column({ type: 'varchar', nullable: true })
  updatedByIp: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
