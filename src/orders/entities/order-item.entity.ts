import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { OrderEntity } from './order.entity';
import { ItemEntity } from 'src/items/entities/item.entity';

@Entity('order_item_master')
export class OrderItemEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @ManyToOne(() => OrderEntity)
  @JoinColumn({ name: 'orderId' })
  order: OrderEntity;

  @Column({ type: 'int' })
  orderId: number;

  @Column({ type: 'int' })
  itemId: number;

  @ManyToOne(() => ItemEntity)
  @JoinColumn({ name: 'itemId' })
  item: ItemEntity;

  @Column({ type: 'int' })
  qty: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  rate: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'boolean', default: false })
  orderedByBox: boolean;

  @Column({ type: 'int', default: 0, nullable: true })
  boxCount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, nullable: true })
  boxRate: number;
}
