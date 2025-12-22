import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataAccessControlService } from './services/data-access-control.service';
import { UserEntity } from 'src/users/entities/user.entity';
import { DistributorEntity } from 'src/users/entities/distributor.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, DistributorEntity])],
  providers: [DataAccessControlService],
  exports: [DataAccessControlService],
})
export class CommonModule {}
