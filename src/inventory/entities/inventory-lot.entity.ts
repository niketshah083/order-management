import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ItemEntity } from '../../items/entities/item.entity';
import { UserEntity } from '../../users/entities/user.entity';
import { CommonConstants } from '../../common/constants/common.constant';

@Entity('inventory_lot')
@Index(['lotNumber', 'itemId'], { unique: true })
@Index(['itemId'])
@Index(['expiryDate'])
@Index(['status'])
@Index(['distributorId'])
export class InventoryLotEntity {
  @PrimaryGeneratedColumn()
  id: number;

  // Identification
  @Column({ type: 'varchar', length: 100 })
  lotNumber: string;

  @Column({ type: 'int' })
  itemId: number;

  @ManyToOne(() => ItemEntity)
  @JoinColumn({ name: 'itemId' })
  item: ItemEntity;

  // Dates
  @Column({ type: 'date', nullable: true })
  manufactureDate: string;

  @Column({ type: 'date', nullable: true })
  expiryDate: string;

  @Column({ type: 'date', nullable: true })
  receivedDate: string;

  // Source tracking
  @Column({ type: 'int', nullable: true })
  supplierId: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  supplierBatchNo: string;

  @Column({ type: 'int', nullable: true })
  purchaseOrderId: number;

  @Column({ type: 'int', nullable: true })
  grnId: number;

  // Quality
  @Column({
    type: 'enum',
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'QUARANTINE'],
    default: 'APPROVED',
  })
  qualityStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'QUARANTINE';

  @Column({ type: 'int', nullable: true })
  qualityCheckedBy: number;

  @Column({ type: 'timestamp', nullable: true })
  qualityCheckedAt: Date;

  @Column({ type: 'text', nullable: true })
  qualityNotes: string;

  // Cost tracking
  @Column({
    type: 'decimal',
    precision: 16,
    scale: 4,
    nullable: true,
    transformer: CommonConstants.decimalToNumberTransformer(),
  })
  unitCost: number;

  @Column({
    type: 'decimal',
    precision: 16,
    scale: 4,
    nullable: true,
    transformer: CommonConstants.decimalToNumberTransformer(),
  })
  landedCost: number;

  // Status
  @Column({
    type: 'enum',
    enum: ['ACTIVE', 'EXPIRED', 'BLOCKED', 'CONSUMED'],
    default: 'ACTIVE',
  })
  status: 'ACTIVE' | 'EXPIRED' | 'BLOCKED' | 'CONSUMED';

  @Column({ type: 'varchar', length: 255, nullable: true })
  blockedReason: string;

  @Column({ type: 'int', nullable: true })
  blockedBy: number;

  @Column({ type: 'timestamp', nullable: true })
  blockedAt: Date;

  // Metadata
  @Column({ type: 'json', nullable: true })
  attributes: Record<string, any>;

  // Owner
  @Column({ type: 'int', nullable: true })
  distributorId: number;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'distributorId' })
  distributor: UserEntity;

  @Column({ type: 'int', nullable: true })
  warehouseId: number;

  // Audit
  @Column({ type: 'int', nullable: true })
  createdBy: number;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'createdBy' })
  createdByUser: UserEntity;

  @Column({ type: 'int', nullable: true })
  updatedBy: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
