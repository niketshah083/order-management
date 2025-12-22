import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  ManyToMany,
} from 'typeorm';
import { UserEntity } from './user.entity';

@Entity('distributor_master')
export class DistributorEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'int', unique: true })
  userId: number;

  @OneToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  @Column({ type: 'varchar', length: 15, nullable: true })
  gstin: string;

  @Column({ type: 'text', nullable: true })
  addressLine1: string;

  @Column({ type: 'text', nullable: true })
  addressLine2: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  state: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  pincode: string;

  @Column({ type: 'int', default: 0 })
  creditLimitDays: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  creditLimitAmount: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  businessName: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  ownerName: string;

  @ManyToMany(() => UserEntity, (user) => user.managedDistributors)
  managers: UserEntity[];

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
