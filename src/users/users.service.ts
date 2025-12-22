import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { UserEntity } from './entities/user.entity';
import { DistributorEntity } from './entities/distributor.entity';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity) private repo: Repository<UserEntity>,
    @InjectRepository(DistributorEntity) private distributorRepo: Repository<DistributorEntity>,
  ) {}

  async findAll() {
    return this.repo.find({
      relations: ['distributor', 'managedDistributors', 'managedDistributors.user'],
    });
  }

  async findByEmail(email: string) {
    return this.repo.findOne({ where: { email } });
  }

  async findByMobile(mobileNo: string) {
    return this.repo.findOne({ where: { mobileNo } });
  }

  async findOne(id: number) {
    return this.repo.findOne({
      where: { id },
      relations: ['distributor', 'managedDistributors', 'managedDistributors.user'],
    });
  }

  async create(dto: CreateUserDto) {
    const hashed = await bcrypt.hash(dto.password, 10);
    
    const user = this.repo.create({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      mobileNo: dto.mobileNo,
      password: hashed,
      role: dto.role as 'super_admin' | 'distributor' | 'manager',
    });

    const savedUser = await this.repo.save(user);

    if (dto.role === 'distributor') {
      const distributor = this.distributorRepo.create({
        userId: savedUser.id,
        gstin: dto.gstin,
        addressLine1: dto.addressLine1,
        addressLine2: dto.addressLine2,
        city: dto.city,
        state: dto.state,
        pincode: dto.pincode,
        creditLimitDays: dto.creditLimitDays || 0,
        creditLimitAmount: dto.creditLimitAmount || 0,
        businessName: dto.businessName,
        ownerName: dto.ownerName,
      });
      await this.distributorRepo.save(distributor);
    }

    if (dto.role === 'manager' && dto.distributorIds && dto.distributorIds.length > 0) {
      const distributors = await this.distributorRepo.find({
        where: { id: In(dto.distributorIds) },
      });

      if (distributors.length !== dto.distributorIds.length) {
        throw new BadRequestException('One or more distributor IDs are invalid');
      }

      const userWithDistributors = await this.repo.findOne({
        where: { id: savedUser.id },
        relations: ['managedDistributors'],
      });

      if (userWithDistributors) {
        userWithDistributors.managedDistributors = distributors;
        await this.repo.save(userWithDistributors);
      }
    }

    return this.repo.findOne({
      where: { id: savedUser.id },
      relations: ['distributor', 'managedDistributors', 'managedDistributors.user'],
    });
  }

  async update(id: number, dto: Partial<CreateUserDto>) {
    const user = await this.repo.findOne({
      where: { id },
      relations: ['distributor', 'managedDistributors'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (dto.password) {
      dto.password = await bcrypt.hash(dto.password, 10);
    }

    if (dto.firstName !== undefined) user.firstName = dto.firstName;
    if (dto.lastName !== undefined) user.lastName = dto.lastName;
    if (dto.email !== undefined) user.email = dto.email;
    if (dto.mobileNo !== undefined) user.mobileNo = dto.mobileNo;
    if (dto.password !== undefined) user.password = dto.password;
    if (dto.role !== undefined) user.role = dto.role as 'super_admin' | 'distributor' | 'manager';

    await this.repo.save(user);

    if (dto.role === 'distributor') {
      let distributor = await this.distributorRepo.findOne({
        where: { userId: user.id },
      });

      if (distributor) {
        Object.assign(distributor, {
          gstin: dto.gstin,
          addressLine1: dto.addressLine1,
          addressLine2: dto.addressLine2,
          city: dto.city,
          state: dto.state,
          pincode: dto.pincode,
          creditLimitDays: dto.creditLimitDays || distributor.creditLimitDays,
          creditLimitAmount: dto.creditLimitAmount || distributor.creditLimitAmount,
        });
        await this.distributorRepo.save(distributor);
      } else {
        distributor = this.distributorRepo.create({
          userId: user.id,
          gstin: dto.gstin,
          addressLine1: dto.addressLine1,
          addressLine2: dto.addressLine2,
          city: dto.city,
          state: dto.state,
          pincode: dto.pincode,
          creditLimitDays: dto.creditLimitDays || 0,
          creditLimitAmount: dto.creditLimitAmount || 0,
        });
        await this.distributorRepo.save(distributor);
      }
    }

    const isManagerRole = dto.role === 'manager' || user.role === 'manager';
    
    if (isManagerRole && dto.distributorIds !== undefined) {
      if (dto.distributorIds.length > 0) {
        const distributors = await this.distributorRepo.find({
          where: { id: In(dto.distributorIds) },
        });

        if (distributors.length !== dto.distributorIds.length) {
          throw new BadRequestException('One or more distributor IDs are invalid');
        }

        user.managedDistributors = distributors;
      } else {
        user.managedDistributors = [];
      }
      await this.repo.save(user);
    }

    return this.repo.findOne({
      where: { id: user.id },
      relations: ['distributor', 'managedDistributors', 'managedDistributors.user'],
    });
  }

  async getAllDistributors() {
    return this.distributorRepo.find({
      relations: ['user'],
    });
  }

  async seedDefaultUsers() {
    const superAdminEmail = 'admin@yopmail.com';
    if (!(await this.findByEmail(superAdminEmail))) {
      await this.create({
        firstName: 'Super',
        lastName: 'Admin',
        email: superAdminEmail,
        mobileNo: '1111111111',
        password: 'Admin@123',
        role: 'super_admin',
      });
    }
  }

  async bulkImportDistributors(data: any[]) {
    const results = { success: 0, failed: 0, errors: [] };

    for (const row of data) {
      try {
        const hashed = await bcrypt.hash(row.password || 'Password@123', 10);
        
        const user = this.repo.create({
          firstName: row.firstName || row.ownerName || 'Unknown',
          lastName: row.lastName || '',
          email: row.email,
          mobileNo: row.phone || row.mobileNo,
          password: hashed,
          role: 'distributor' as any,
        });

        const savedUser = await this.repo.save(user);

        const distributor = this.distributorRepo.create({
          userId: savedUser.id,
          gstin: row.gstin || '',
          addressLine1: row.address || row.addressLine1 || '',
          addressLine2: row.addressLine2 || '',
          city: row.city || '',
          state: row.state || '',
          pincode: row.pincode || '',
          creditLimitDays: row.creditLimitDays || 0,
          creditLimitAmount: row.creditLimitAmount || 0,
          businessName: row.businessName || '',
          ownerName: row.ownerName || row.firstName || '',
        });
        await this.distributorRepo.save(distributor);
        results.success++;
      } catch (error: any) {
        results.failed++;
        results.errors.push(`Row error: ${error.message}`);
      }
    }

    return results;
  }
}
