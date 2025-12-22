import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { InternalUserDistributorEntity } from './internal-user-distributor.entity';
import { UserEntity } from '../../users/entities/user.entity';

@Entity('internal_users')
export class InternalUserEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ unique: true })
  email: string;

  @Column()
  mobileNo: string;

  @Column()
  password: string;

  @Column({ default: 'manager' })
  role: 'super_admin' | 'manager';

  @OneToMany(() => InternalUserDistributorEntity, (assignment) => assignment.internalUser)
  distributorAssignments: InternalUserDistributorEntity[];

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

  @Column({ type: 'timestamp', nullable: true })
  deletedAt: Date;
}
