import { ItemEntity } from 'src/items/entities/item.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PurchaseOrderEntity } from './purchase-order.entity';

@Entity('purchase_order_items')
export class PurchaseOrderItemEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'int' })
  purchaseOrderId: number;

  @Column({ type: 'int' })
  itemId: number;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  unitPrice: number;

  @Column({ type: 'varchar', nullable: true })
  batchNumber?: string;

  @Column({ type: 'varchar', nullable: true })
  serialNumber?: string;

  @Column({ type: 'date', nullable: true })
  expiryDate?: string;

  @ManyToOne(() => PurchaseOrderEntity, (po) => po.items)
  @JoinColumn({ name: 'purchaseOrderId' })
  purchaseOrder: PurchaseOrderEntity;

  @ManyToOne(() => ItemEntity)
  @JoinColumn({ name: 'itemId' })
  item: ItemEntity;
}
