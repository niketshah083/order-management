import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { GrnItemEntity } from './grn-item.entity';

@Entity('grn_batch_details')
export class GrnBatchDetailEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  grnItemId: number;

  @ManyToOne(() => GrnItemEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'grnItemId' })
  grnItem: GrnItemEntity;

  @Column({ type: 'varchar', length: 100 })
  batchNumber: string;

  @Column({ type: 'decimal', precision: 16, scale: 4 })
  quantity: number;

  @Column({ type: 'varchar', nullable: true })
  serialNumber?: string;

  @Column({ type: 'date', nullable: true })
  expiryDate: string;

  @CreateDateColumn()
  createdAt: Date;
}
