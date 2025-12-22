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
import { InventoryLotEntity } from './inventory-lot.entity';
import { InventorySerialEntity } from './inventory-serial.entity';
import { WarehouseEntity } from './warehouse.entity';
import { CommonConstants } from '../../common/constants/common.constant';

// Transaction types
export type TransactionType =
  | 'GRN_RECEIPT'
  | 'OPENING_STOCK'
  | 'PURCHASE_RETURN'
  | 'SALES_ISSUE'
  | 'SALES_RETURN'
  | 'TRANSFER_OUT'
  | 'TRANSFER_IN'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT'
  | 'DAMAGE_WRITE_OFF'
  | 'EXPIRY_WRITE_OFF'
  | 'RESERVATION'
  | 'RESERVATION_RELEASE';

// Movement types
export type MovementType = 'IN' | 'OUT' | 'RESERVE' | 'RELEASE';

// Reference types
export type ReferenceType =
  | 'PURCHASE_ORDER'
  | 'GRN'
  | 'BILLING'
  | 'SALES_RETURN'
  | 'PURCHASE_RETURN'
  | 'TRANSFER_ORDER'
  | 'ADJUSTMENT'
  | 'OPENING';

@Entity('inventory_transaction')
@Index(['itemId', 'warehouseId'])
@Index(['lotId'])
@Index(['serialId'])
@Index(['referenceType', 'referenceId'])
@Index(['transactionDate'])
@Index(['transactionType'])
@Index(['distributorId'])
export class InventoryTransactionEntity {
  @PrimaryGeneratedColumn()
  id: number;

  // Transaction identification
  @Column({ type: 'varchar', length: 50, unique: true })
  transactionNo: string;

  @Column({ type: 'timestamp' })
  transactionDate: Date;

  // Transaction type
  @Column({
    type: 'enum',
    enum: [
      'GRN_RECEIPT',
      'OPENING_STOCK',
      'PURCHASE_RETURN',
      'SALES_ISSUE',
      'SALES_RETURN',
      'TRANSFER_OUT',
      'TRANSFER_IN',
      'ADJUSTMENT_IN',
      'ADJUSTMENT_OUT',
      'DAMAGE_WRITE_OFF',
      'EXPIRY_WRITE_OFF',
      'RESERVATION',
      'RESERVATION_RELEASE',
    ],
  })
  transactionType: TransactionType;

  // Movement direction
  @Column({
    type: 'enum',
    enum: ['IN', 'OUT', 'RESERVE', 'RELEASE'],
  })
  movementType: MovementType;

  // Item details
  @Column({ type: 'int' })
  itemId: number;

  @ManyToOne(() => ItemEntity)
  @JoinColumn({ name: 'itemId' })
  item: ItemEntity;

  @Column({ type: 'int', nullable: true })
  lotId: number;

  @ManyToOne(() => InventoryLotEntity, { nullable: true })
  @JoinColumn({ name: 'lotId' })
  lot: InventoryLotEntity;

  @Column({ type: 'int', nullable: true })
  serialId: number;

  @ManyToOne(() => InventorySerialEntity, { nullable: true })
  @JoinColumn({ name: 'serialId' })
  serial: InventorySerialEntity;

  // Quantity
  @Column({
    type: 'decimal',
    precision: 16,
    scale: 4,
    transformer: CommonConstants.decimalToNumberTransformer(),
  })
  quantity: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  unit: string;

  // Location
  @Column({ type: 'int' })
  warehouseId: number;

  @ManyToOne(() => WarehouseEntity)
  @JoinColumn({ name: 'warehouseId' })
  warehouse: WarehouseEntity;

  // For transfers
  @Column({ type: 'int', nullable: true })
  fromWarehouseId: number;

  @Column({ type: 'int', nullable: true })
  toWarehouseId: number;

  // Reference document
  @Column({
    type: 'enum',
    enum: [
      'PURCHASE_ORDER',
      'GRN',
      'BILLING',
      'SALES_RETURN',
      'PURCHASE_RETURN',
      'TRANSFER_ORDER',
      'ADJUSTMENT',
      'OPENING',
    ],
    nullable: true,
  })
  referenceType: ReferenceType;

  @Column({ type: 'int', nullable: true })
  referenceId: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  referenceNo: string;

  @Column({ type: 'int', nullable: true })
  referenceLineId: number;

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
  totalCost: number;

  // Running balance (for quick queries)
  @Column({
    type: 'decimal',
    precision: 16,
    scale: 4,
    nullable: true,
    transformer: CommonConstants.decimalToNumberTransformer(),
  })
  runningBalance: number;

  // Status
  @Column({
    type: 'enum',
    enum: ['PENDING', 'COMPLETED', 'CANCELLED', 'REVERSED'],
    default: 'COMPLETED',
  })
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'REVERSED';

  // Reversal tracking
  @Column({ type: 'boolean', default: false })
  isReversed: boolean;

  @Column({ type: 'int', nullable: true })
  reversedByTransactionId: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reversalReason: string;

  // Owner
  @Column({ type: 'int', nullable: true })
  distributorId: number;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'distributorId' })
  distributor: UserEntity;

  // Notes
  @Column({ type: 'text', nullable: true })
  remarks: string;

  // Audit
  @Column({ type: 'int' })
  createdBy: number;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'createdBy' })
  createdByUser: UserEntity;

  @Column({ type: 'int', nullable: true })
  updatedBy: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  ipAddress: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
