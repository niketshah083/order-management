import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { UserEntity } from '../../users/entities/user.entity';
import { ItemEntity } from '../../items/entities/item.entity';

@Entity('purchase_returns')
export class PurchaseReturnEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  returnNo: string;

  @Column('date')
  returnDate: string;

  @Column()
  distributorId: number;

  @ManyToOne(() => UserEntity)
  distributor: UserEntity;

  @Column()
  itemId: number;

  @ManyToOne(() => ItemEntity)
  item: ItemEntity;

  @Column('int')
  quantity: number;

  @Column('decimal', { precision: 12, scale: 2 })
  rate: number;

  @Column('decimal', { precision: 12, scale: 2 })
  totalAmount: number;

  @Column({ nullable: true })
  reason?: string;

  @Column({ default: 'pending' })
  status: 'pending' | 'approved' | 'rejected';

  @Column({ nullable: true })
  rejectionReason?: string;

  @Column({ nullable: true, type: 'text' })
  adminComments?: string;

  @Column({ type: 'varchar', nullable: true })
  batchNumber?: string;

  @Column({ type: 'varchar', nullable: true })
  serialNumber?: string;

  @Column({ type: 'date', nullable: true })
  expiryDate?: string;

  @Column({ type: 'int', nullable: true })
  batchDetailId?: number;

  @Column({ type: 'int', nullable: true })
  serialDetailId?: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
