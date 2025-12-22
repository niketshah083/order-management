import { UserEntity } from 'src/users/entities/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { PurchaseOrderItemEntity } from './purchase-order-item.entity';

@Entity('purchase_order_master')
@Index(['distributorId'])
@Index(['status'])
@Index(['approvalStatus'])
@Index(['createdAt'])
export class PurchaseOrderEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'varchar', length: 255, unique: true })
  poNo: string;

  @Column({ type: 'int' })
  distributorId: number;

  @OneToMany(() => PurchaseOrderItemEntity, (item) => item.purchaseOrder, { cascade: true })
  items: PurchaseOrderItemEntity[];

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'distributorId' })
  distributor: UserEntity;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  totalAmount: number;

  @Column({ type: 'varchar', default: 'PENDING' })
  status: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'createdBy' })
  createdByUser: UserEntity;

  @Column({ type: 'int' })
  createdBy: number;

  @Column({ type: 'int', nullable: true })
  updatedBy: number;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'updatedBy' })
  updatedByUser: UserEntity;

  @Column({ type: 'varchar', nullable: true })
  createdByIp: string;

  @Column({ type: 'varchar', nullable: true })
  updatedByIp: string;

  @Column({ type: 'varchar', default: 'PENDING' })
  approvalStatus: string;

  @Column({ type: 'int', nullable: true })
  approvedBy: number;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'approvedBy' })
  approvedByUser: UserEntity;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date;

  @Column({ type: 'int', nullable: true })
  rejectedBy: number;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'rejectedBy' })
  rejectedByUser: UserEntity;

  @Column({ type: 'timestamp', nullable: true })
  rejectedAt: Date;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string;

  @Column({ type: 'text', nullable: true })
  creditWarning: string;

  @Column({ type: 'varchar', nullable: true })
  invoiceUrl: string;

  @Column({ type: 'varchar', nullable: true })
  invoiceFileName: string;

  @Column({ type: 'varchar', default: 'PENDING' })
  grnStatus: string;

  @Column({ type: 'int', nullable: true })
  grnId: number;
}
