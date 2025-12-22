import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, Or } from 'typeorm';
import { CustomerEntity } from './entities/customer.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(CustomerEntity)
    private customerRepository: Repository<CustomerEntity>,
  ) {}

  async create(createCustomerDto: CreateCustomerDto) {
    const customer = this.customerRepository.create(createCustomerDto);
    return await this.customerRepository.save(customer);
  }

  async findAll(
    search?: string,
    page: number = 1,
    limit: number = 10,
    authorizedDistributorIds?: number[] | null,
  ) {
    const skip = (page - 1) * limit;
    
    let query = this.customerRepository.createQueryBuilder('customer');

    // Apply distributor filter based on authorized IDs
    // If authorizedDistributorIds is null, user is super_admin (see all)
    // If authorizedDistributorIds is array, filter by those IDs
    if (authorizedDistributorIds !== null && authorizedDistributorIds !== undefined) {
      query = query.where('customer.distributorId IN (:...distributorIds)', { 
        distributorIds: authorizedDistributorIds 
      });
    }

    if (search) {
      // Search across all fields: name, mobile, city, email, state
      const searchCondition = '(customer.firstname LIKE :search OR customer.lastname LIKE :search OR customer.mobileNo LIKE :search OR customer.city LIKE :search OR customer.emailId LIKE :search OR customer.state LIKE :search)';
      query = query.andWhere(searchCondition, { search: `%${search}%` });
    }

    const [data, totalCount] = await query
      .skip(skip)
      .take(limit)
      .orderBy('customer.createdAt', 'DESC')
      .getManyAndCount();

    const totalPages = Math.ceil(totalCount / limit);

    return {
      data,
      totalCount,
      page,
      limit,
      totalPages,
    };
  }

  async findOne(id: number) {
    return await this.customerRepository.findOne({ where: { id } });
  }

  async update(id: number, updateCustomerDto: Partial<CreateCustomerDto>) {
    await this.customerRepository.update(id, updateCustomerDto);
    return await this.findOne(id);
  }

  async remove(id: number) {
    await this.customerRepository.delete(id);
    return { message: 'Customer deleted successfully' };
  }
}
