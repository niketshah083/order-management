import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InternalUserEntity } from './entities/internal-user.entity';
import { CreateInternalUserDto } from './dto/create-internal-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class InternalUsersService {
  constructor(
    @InjectRepository(InternalUserEntity)
    private internalUserRepository: Repository<InternalUserEntity>,
  ) {}

  async create(createInternalUserDto: CreateInternalUserDto) {
    const hashedPassword = await bcrypt.hash(createInternalUserDto.password, 10);
    const internalUser = this.internalUserRepository.create({
      ...createInternalUserDto,
      password: hashedPassword,
    });
    const saved = await this.internalUserRepository.save(internalUser);
    delete saved.password;
    return saved;
  }

  async findAll() {
    const users = await this.internalUserRepository.find();
    return users.map((user) => {
      delete user.password;
      return user;
    });
  }

  async findOne(id: number) {
    const user = await this.internalUserRepository.findOne({ where: { id } });
    if (user) delete user.password;
    return user;
  }

  async update(id: number, updateInternalUserDto: Partial<CreateInternalUserDto>) {
    if (updateInternalUserDto.password) {
      updateInternalUserDto.password = await bcrypt.hash(
        updateInternalUserDto.password,
        10,
      );
    }
    await this.internalUserRepository.update(id, updateInternalUserDto);
    return await this.findOne(id);
  }

  async remove(id: number) {
    await this.internalUserRepository.delete(id);
    return { message: 'Internal user deleted successfully' };
  }
}
