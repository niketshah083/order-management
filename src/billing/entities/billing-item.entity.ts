import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { BillingEntity } from './billing.entity';
import { ItemEntity } from '../../items/entities/item.entity';

@Entity('billing_items')
export class BillingItemEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  billingId: number;

  @ManyToOne(() => BillingEntity, (billing) => billing.billingItems, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'billingId' })
  billing: BillingEntity;

  @Column()
  itemId: number;

  @ManyToOne(() => ItemEntity)
  @JoinColumn({ name: 'itemId' })
  item: ItemEntity;

  @Column({ type: 'varchar' })
  itemName: string;

  @Column({ type: 'varchar' })
  unit: string;

  @Column({ type: 'decimal', precision: 16, scale: 4 })
  quantity: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  rate: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  discount: number;

  @Column({ type: 'varchar', default: 'percentage' })
  discountType: 'percentage' | 'amount';

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  taxableAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  cgst: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  sgst: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  igst: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  totalAmount: number;

  @Column({ type: 'varchar', nullable: true })
  batchNumber?: string;

  @Column({ type: 'varchar', nullable: true })
  serialNumber?: string;

  @Column({ type: 'date', nullable: true })
  expiryDate?: string;

  @Column({ type: 'boolean', default: false })
  orderedByBox: boolean;

  @Column({ type: 'int', default: 0, nullable: true })
  boxCount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  boxRate: number;

  @Column({ type: 'int', default: 1, nullable: true })
  unitsPerBox: number;
}
