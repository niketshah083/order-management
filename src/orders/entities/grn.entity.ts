import { UserEntity } from 'src/users/entities/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { PurchaseOrderEntity } from './purchase-order.entity';
import { GrnItemEntity } from './grn-item.entity';

@Entity('grn_master')
@Index(['purchaseOrderId'])
@Index(['distributorId'])
@Index(['status'])
@Index(['createdAt'])
export class GrnEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'varchar', length: 255, unique: true })
  grnNo: string;

  @Column({ type: 'int' })
  purchaseOrderId: number;

  @Column({ type: 'int' })
  distributorId: number;

  @OneToMany(() => GrnItemEntity, (item) => item.grn, { cascade: true })
  items: GrnItemEntity[];

  @ManyToOne(() => PurchaseOrderEntity)
  @JoinColumn({ name: 'purchaseOrderId' })
  purchaseOrder: PurchaseOrderEntity;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'distributorId' })
  distributor: UserEntity;

  @Column({ type: 'varchar', default: 'DRAFT' })
  status: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  totalAmount: number;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  @Column({ type: 'int' })
  createdBy: number;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'createdBy' })
  createdByUser: UserEntity;

  @Column({ type: 'int', nullable: true })
  updatedBy: number;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'updatedBy' })
  updatedByUser: UserEntity;

  @Column({ type: 'varchar', nullable: true })
  createdByIp: string;

  @Column({ type: 'varchar', nullable: true })
  updatedByIp: string;

  @Column({ type: 'int', nullable: true })
  approvedBy: number;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'approvedBy' })
  approvedByUser: UserEntity;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date;

  @Column({ type: 'text', nullable: true })
  remarks: string;
}
