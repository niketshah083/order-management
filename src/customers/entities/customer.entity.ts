import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { UserEntity } from '../../users/entities/user.entity';

@Entity('customers')
@Index(['distributorId'])
@Index(['mobileNo'])
@Index(['gstin'])
export class CustomerEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  mobileNo: string;

  @Column()
  firstname: string;

  @Column({ nullable: true })
  lastname: string;

  @Column({ nullable: true })
  emailId: string;

  @Column({ nullable: true })
  gstin: string;

  @Column({ nullable: true })
  addressLine1: string;

  @Column({ nullable: true })
  addressLine2: string;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  state: string;

  @Column({ nullable: true })
  pincode: string;

  @Column({ nullable: true })
  country: string;

  @Column({ nullable: true })
  distributorId: number;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'distributorId' })
  distributor: UserEntity;

  @Column({ type: 'int', nullable: true })
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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamp', nullable: true })
  deletedAt: Date;
}
