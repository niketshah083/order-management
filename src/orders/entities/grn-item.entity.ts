import { ItemEntity } from 'src/items/entities/item.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { GrnEntity } from './grn.entity';

@Entity('grn_items')
export class GrnItemEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'int' })
  grnId: number;

  @Column({ type: 'int' })
  poItemId: number;

  @Column({ type: 'int' })
  itemId: number;

  @Column({ type: 'int' })
  receivedQuantity: number;

  @Column({ type: 'int' })
  originalQuantity: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  unitPrice: number;

  @Column({ type: 'varchar', nullable: true })
  batchNumber?: string;

  @Column({ type: 'varchar', nullable: true })
  serialNumber?: string;

  @Column({ type: 'date', nullable: true })
  expiryDate?: string;

  @Column({ type: 'int', default: 0 })
  pendingQuantity: number;

  @ManyToOne(() => GrnEntity, (grn) => grn.items)
  @JoinColumn({ name: 'grnId' })
  grn: GrnEntity;

  @ManyToOne(() => ItemEntity)
  @JoinColumn({ name: 'itemId' })
  item: ItemEntity;
}
