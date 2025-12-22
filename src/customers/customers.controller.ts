import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Req, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam, ApiQuery, ApiOkResponse, ApiBearerAuth } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { ExtendedRequest } from 'src/common/middleware/jwt.middleware';
import { DistributorEntity } from 'src/users/entities/distributor.entity';
import { DataAccessControlService } from 'src/common/services/data-access-control.service';

@ApiBearerAuth('authorization')
@ApiTags('Customers')
@Controller('customers')
export class CustomersController {
  constructor(
    private readonly customersService: CustomersService,
    private readonly dataAccessControl: DataAccessControlService,
    @InjectRepository(DistributorEntity)
    private distributorRepository: Repository<DistributorEntity>,
  ) {}

  @Post()
  @ApiOperation({ 
    summary: 'Create Customer',
    description: 'Create a new customer record. Distributors see only customers assigned to them. Admin/Manager must specify which distributor the customer belongs to.'
  })
  @ApiBody({ type: CreateCustomerDto, description: 'Customer details. distributorId is required for admin/manager users.' })
  @ApiOkResponse({ description: 'Customer created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid customer data or missing distributorId for admin/manager' })
  async create(@Body() createCustomerDto: CreateCustomerDto, @Req() req: ExtendedRequest) {
    const userRole = req.userDetails?.role;
    const userId = req.userDetails?.userId;
    
    // If distributor, auto-assign to their ID
    if (userRole === 'distributor' && userId) {
      (createCustomerDto as any).distributorId = userId;
    } else if (userRole === 'super_admin' || userRole === 'manager') {
      // For admin/manager, distributorId must be explicitly provided
      if (!createCustomerDto.distributorId) {
        throw new BadRequestException('distributorId is required. You must specify which distributor this customer belongs to.');
      }
    }
    
    try {
      const customer = await this.customersService.create(createCustomerDto);
      return { statusCode: 201, data: customer, message: 'Customer created successfully' };
    } catch (error) {
      throw new BadRequestException(`Failed to create customer: ${error.message}`);
    }
  }

  @Get()
  @ApiOperation({ 
    summary: 'Get All Customers',
    description: 'Retrieve list of customers with search, filtering, and pagination. Data isolation enforced by role: Super Admin sees all, Distributor sees only their customers, Manager sees assigned distributors customers.'
  })
  @ApiQuery({ name: 'search', required: false, description: 'Search by name, email, mobile, city, or state' })
  @ApiQuery({ name: 'page', required: false, type: 'number', description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: 'number', description: 'Items per page (default: 10)' })
  @ApiOkResponse({ description: 'Customers retrieved successfully' })
  async findAll(
    @Req() req: ExtendedRequest,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    try {
      const pageNumber = page ? parseInt(page, 10) : 1;
      const limitNumber = limit ? parseInt(limit, 10) : 10;
      
      const userRole = req.userDetails?.role;
      const userId = req.userDetails?.userId;
      
      const authorizedDistributorIds = await this.dataAccessControl.getAuthorizedDistributorIds(
        userId,
        userRole,
      );
      
      const result = await this.customersService.findAll(
        search,
        pageNumber,
        limitNumber,
        authorizedDistributorIds,
      );
      
      return { 
        data: result.data,
        totalCount: result.totalCount,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      };
    } catch (error) {
      throw new BadRequestException(`Failed to fetch customers: ${error.message}`);
    }
  }

  @Get(':id')
  @ApiOperation({ 
    summary: 'Get Customer Details',
    description: 'Retrieve details of a specific customer'
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Customer ID' })
  @ApiOkResponse({ description: 'Customer retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async findOne(@Param('id') id: string) {
    const customer = await this.customersService.findOne(+id);
    return { statusCode: 200, data: customer };
  }

  @Patch(':id')
  @ApiOperation({ 
    summary: 'Update Customer',
    description: 'Update customer details including activation/inactivation'
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Customer ID' })
  @ApiBody({ type: CreateCustomerDto, description: 'Updated customer details' })
  @ApiOkResponse({ description: 'Customer updated successfully' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async update(
    @Param('id') id: string,
    @Body() updateCustomerDto: Partial<CreateCustomerDto>,
  ) {
    const customer = await this.customersService.update(+id, updateCustomerDto);
    return { statusCode: 200, data: customer };
  }

  @Delete(':id')
  @ApiOperation({ 
    summary: 'Delete Customer',
    description: 'Delete a customer record'
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Customer ID' })
  @ApiOkResponse({ description: 'Customer deleted successfully' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async remove(@Param('id') id: string) {
    const result = await this.customersService.remove(+id);
    return { statusCode: 200, data: result };
  }
}
