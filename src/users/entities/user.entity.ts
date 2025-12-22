import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { DistributorEntity } from './distributor.entity';

@Entity('user_master')
export class UserEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'varchar', length: 255 })
  firstName: string;

  @Column({ type: 'varchar', length: 255 })
  lastName: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  mobileNo: string;

  @Column({ type: 'varchar', length: 255 })
  password: string;

  @Column({ type: 'varchar', length: 50 })
  role: 'super_admin' | 'distributor' | 'manager';

  @OneToOne(() => DistributorEntity, (distributor) => distributor.user)
  distributor: DistributorEntity;

  @ManyToMany(() => DistributorEntity, (distributor) => distributor.managers)
  @JoinTable({
    name: 'manager_distributor',
    joinColumn: { name: 'managerId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'distributorId', referencedColumnName: 'id' },
  })
  managedDistributors: DistributorEntity[];

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
