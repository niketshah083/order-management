import { CommonConstants } from 'src/common/constants/common.constant';
import { UserEntity } from 'src/users/entities/user.entity';
import { CategoryEntity } from 'src/categories/entities/category.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity('item_master')
export class ItemEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', nullable: false })
  name: string;

  @Column({ type: 'varchar', nullable: true })
  unit: string;

  @Column({
    type: 'decimal',
    precision: 16,
    scale: 4,
    default: 0,
    transformer: CommonConstants.decimalToNumberTransformer(),
  })
  alterQty: number;

  @Column({
    type: 'decimal',
    precision: 16,
    scale: 2,
    default: 0,
    transformer: CommonConstants.decimalToNumberTransformer(),
  })
  rate: number;

  @Column({
    type: 'decimal',
    precision: 16,
    scale: 4,
    default: 0,
    transformer: CommonConstants.decimalToNumberTransformer(),
  })
  qty: number;

  @Column({
    type: 'json',
    nullable: true,
    transformer: CommonConstants.stringToJsonTransformer(),
  })
  assets: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;

  @Column({ type: 'varchar' })
  createdByIp: string;

  @Column({ type: 'varchar', nullable: true })
  updatedByIp: string;

  @Column({ type: 'varchar', nullable: true })
  hsn: string;

  @Column({ type: 'varchar', nullable: true })
  sac: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  gstRate: number;

  @Column({ type: 'varchar', nullable: true })
  description: string;

  @Column({ type: 'varchar', nullable: true })
  sku: string;

  @Column({ type: 'boolean', default: false })
  isDisabled: boolean;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'createdBy' })
  createdByUser: UserEntity;

  @Column({ type: 'int', nullable: true })
  createdBy: number;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'updatedBy' })
  updatedByUser: UserEntity;

  @Column({ type: 'int', nullable: true })
  updatedBy: number;

  @Column({ type: 'int', nullable: true })
  categoryId: number;

  @ManyToOne(() => CategoryEntity, (category) => category.items, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'categoryId' })
  category: CategoryEntity;

  @Column({ type: 'boolean', default: false })
  hasBatchTracking: boolean;

  @Column({ type: 'boolean', default: false })
  hasSerialTracking: boolean;

  @Column({ type: 'boolean', default: false })
  hasExpiryDate: boolean;

  @Column({ type: 'boolean', default: false })
  hasBoxPackaging: boolean;

  @Column({
    type: 'decimal',
    precision: 16,
    scale: 2,
    default: 0,
    nullable: true,
    transformer: CommonConstants.decimalToNumberTransformer(),
  })
  boxRate: number;

  @Column({ type: 'int', default: 1, nullable: true })
  unitsPerBox: number;

  // Agricultural fields for crop and disease tracking
  @Column({ type: 'varchar', nullable: true })
  crop: string;

  @Column({ type: 'varchar', nullable: true })
  disease: string;

  @Column({ type: 'varchar', nullable: true })
  targetPest: string;
}
