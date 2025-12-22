import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { InternalUserEntity } from './internal-user.entity';
import { DistributorEntity } from '../../users/entities/distributor.entity';

@Entity('internal_user_distributor')
export class InternalUserDistributorEntity {
  @PrimaryColumn()
  internalUserId: number;

  @PrimaryColumn()
  distributorId: number;

  @ManyToOne(() => InternalUserEntity, (user) => user.distributorAssignments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'internalUserId' })
  internalUser: InternalUserEntity;

  @ManyToOne(() => DistributorEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'distributorId' })
  distributor: DistributorEntity;

  @CreateDateColumn()
  assignedAt: Date;
}
