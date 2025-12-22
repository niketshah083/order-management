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

@Entity('item_batch')
@Index(['batchNumber'])
@Index(['itemId'])
@Index(['distributorId'])
export class ItemBatchEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'bigint', name: 'company_id' })
  companyId: number;

  @Column({ type: 'bigint', name: 'item_id' })
  itemId: number;

  @ManyToOne(() => ItemEntity)
  @JoinColumn({ name: 'item_id' })
  item: ItemEntity;

  @Column({ type: 'bigint', name: 'distributor_id', nullable: true })
  distributorId: number;

  @Column({ type: 'bigint', name: 'warehouse_id', nullable: true })
  warehouseId: number;

  @Column({ type: 'varchar', length: 150, name: 'batch_number' })
  batchNumber: string;

  @Column({ type: 'date', name: 'manufacture_date', nullable: true })
  manufactureDate: string;

  @Column({ type: 'date', name: 'expiry_date', nullable: true })
  expiryDate: string;

  @Column({ type: 'decimal', precision: 18, scale: 6, name: 'received_qty', default: 0 })
  receivedQty: number;

  @Column({ type: 'decimal', precision: 18, scale: 6, name: 'reserved_qty', default: 0 })
  reservedQty: number;

  @Column({ type: 'decimal', precision: 18, scale: 6, name: 'issued_qty', default: 0 })
  issuedQty: number;

  @Column({ type: 'decimal', precision: 18, scale: 6, name: 'available_qty', default: 0 })
  availableQty: number;

  @Column({ type: 'tinyint', name: 'is_blocked', default: 0 })
  isBlocked: number;

  @Column({ type: 'tinyint', name: 'is_expired', default: 0 })
  isExpired: number;

  @CreateDateColumn({ type: 'datetime', precision: 6, name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime', precision: 6, name: 'updated_at' })
  updatedAt: Date;
}
