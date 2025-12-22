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
import { WarehouseEntity } from './warehouse.entity';
import { CustomerEntity } from '../../customers/entities/customer.entity';
import { CommonConstants } from '../../common/constants/common.constant';

@Entity('inventory_serial')
@Index(['serialNumber', 'itemId'], { unique: true })
@Index(['itemId'])
@Index(['status'])
@Index(['lotId'])
@Index(['distributorId'])
export class InventorySerialEntity {
  @PrimaryGeneratedColumn()
  id: number;

  // Identification
  @Column({ type: 'varchar', length: 200 })
  serialNumber: string;

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

  // Current state
  @Column({
    type: 'enum',
    enum: ['AVAILABLE', 'RESERVED', 'SOLD', 'RETURNED', 'DAMAGED', 'SCRAPPED'],
    default: 'AVAILABLE',
  })
  status:
    | 'AVAILABLE'
    | 'RESERVED'
    | 'SOLD'
    | 'RETURNED'
    | 'DAMAGED'
    | 'SCRAPPED';

  @Column({ type: 'int', nullable: true })
  currentWarehouseId: number;

  @ManyToOne(() => WarehouseEntity, { nullable: true })
  @JoinColumn({ name: 'currentWarehouseId' })
  currentWarehouse: WarehouseEntity;

  @Column({
    type: 'enum',
    enum: ['COMPANY', 'DISTRIBUTOR', 'CUSTOMER'],
    nullable: true,
  })
  currentOwnerType: 'COMPANY' | 'DISTRIBUTOR' | 'CUSTOMER';

  @Column({ type: 'int', nullable: true })
  currentOwnerId: number;

  // Source tracking
  @Column({ type: 'int', nullable: true })
  purchaseOrderId: number;

  @Column({ type: 'int', nullable: true })
  grnId: number;

  @Column({ type: 'date', nullable: true })
  receivedDate: string;

  // Sale tracking
  @Column({ type: 'int', nullable: true })
  billingId: number;

  @Column({ type: 'date', nullable: true })
  soldDate: string;

  @Column({ type: 'int', nullable: true })
  customerId: number;

  @ManyToOne(() => CustomerEntity, { nullable: true })
  @JoinColumn({ name: 'customerId' })
  customer: CustomerEntity;

  // Warranty
  @Column({ type: 'date', nullable: true })
  warrantyStartDate: string;

  @Column({ type: 'date', nullable: true })
  warrantyEndDate: string;

  @Column({ type: 'text', nullable: true })
  warrantyTerms: string;

  // Cost
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
  sellingPrice: number;

  // Quality
  @Column({
    type: 'enum',
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    default: 'APPROVED',
  })
  qualityStatus: 'PENDING' | 'APPROVED' | 'REJECTED';

  // Metadata
  @Column({ type: 'json', nullable: true })
  attributes: Record<string, any>;

  // Owner
  @Column({ type: 'int', nullable: true })
  distributorId: number;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'distributorId' })
  distributor: UserEntity;

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
