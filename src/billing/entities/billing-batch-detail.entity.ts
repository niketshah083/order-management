import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { BillingEntity } from './billing.entity';
import { InventoryLotEntity } from '../../inventory/entities/inventory-lot.entity';
import { InventorySerialEntity } from '../../inventory/entities/inventory-serial.entity';

@Entity('billing_batch_details')
export class BillingBatchDetailEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  billingId: number;

  @ManyToOne(() => BillingEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'billingId' })
  billing: BillingEntity;

  @Column()
  itemId: number;

  // Reference to enterprise inventory lot (replaces legacy batchDetailId)
  @Column({ nullable: true })
  lotId?: number;

  @ManyToOne(() => InventoryLotEntity, { nullable: true })
  @JoinColumn({ name: 'lotId' })
  lot?: InventoryLotEntity;

  // Reference to enterprise inventory serial (replaces legacy serialDetailId)
  @Column({ nullable: true })
  serialId?: number;

  @ManyToOne(() => InventorySerialEntity, { nullable: true })
  @JoinColumn({ name: 'serialId' })
  serial?: InventorySerialEntity;

  @Column({ type: 'varchar', nullable: true })
  batchNumber: string;

  @Column({ type: 'varchar', nullable: true })
  serialNumber: string;

  @Column({ type: 'date', nullable: true })
  expiryDate: string;

  @Column({ type: 'decimal', precision: 16, scale: 4 })
  quantity: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  rate: number;

  @CreateDateColumn()
  deliveredAt: Date;
}
