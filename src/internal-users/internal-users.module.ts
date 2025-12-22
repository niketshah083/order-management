import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InternalUserEntity } from './entities/internal-user.entity';
import { InternalUsersService } from './internal-users.service';
import { InternalUsersController } from './internal-users.controller';

@Module({
  imports: [TypeOrmModule.forFeature([InternalUserEntity])],
  providers: [InternalUsersService],
  controllers: [InternalUsersController],
})
export class InternalUsersModule {}
