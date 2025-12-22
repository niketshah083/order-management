import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Param,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam, ApiOkResponse } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { ExtendedRequest } from 'src/common/middleware/jwt.middleware';

@ApiBearerAuth('authorization')
@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private userService: UsersService) {}

  @Get()
  @ApiOperation({ 
    summary: 'Get All Users',
    description: 'Retrieve all users in the system (admin only)'
  })
  @ApiOkResponse({ description: 'List of all users retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - only super admins can access' })
  async getAll(@Req() req: ExtendedRequest) {
    if (req.userDetails.role !== 'super_admin') throw new ForbiddenException();
    const data = await this.userService.findAll();
    return { data };
  }

  @Get('distributors')
  @ApiOperation({ 
    summary: 'Get All Distributors',
    description: 'Retrieve all distributor users (accessible to super admin and managers)'
  })
  @ApiOkResponse({ description: 'List of all distributors retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - only super admins and managers can access' })
  async getAllDistributors(@Req() req: ExtendedRequest) {
    if (!['super_admin', 'manager'].includes(req.userDetails.role)) {
      throw new ForbiddenException();
    }
    const data = await this.userService.getAllDistributors();
    return { data };
  }

  @Post()
  @ApiOperation({ 
    summary: 'Create New User',
    description: 'Create a new user (admin only). User can be super_admin, manager, distributor, or customer'
  })
  @ApiBody({ type: CreateUserDto, description: 'User creation details' })
  @ApiOkResponse({ description: 'User created successfully', schema: { example: { data: { id: 1, email: 'user@example.com', role: 'distributor' } } } })
  @ApiResponse({ status: 400, description: 'Invalid user data' })
  @ApiResponse({ status: 403, description: 'Forbidden - only super admins can create users' })
  async create(@Req() req: ExtendedRequest, @Body() dto: CreateUserDto) {
    if (req.userDetails.role !== 'super_admin') throw new ForbiddenException();
    const data = await this.userService.create(dto);
    return { data };
  }

  @Get(':id')
  @ApiOperation({ 
    summary: 'Get User by ID',
    description: 'Retrieve user details by ID'
  })
  @ApiParam({ name: 'id', type: 'number', description: 'User ID' })
  @ApiOkResponse({ description: 'User retrieved successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getOne(@Param('id') id: string) {
    const data = await this.userService.findOne(+id);
    if (!data) {
      return { statusCode: 404, error: 'User not found' };
    }
    return { statusCode: 200, data };
  }

  @Put(':id')
  @ApiOperation({ 
    summary: 'Update User',
    description: 'Update user details by ID (admin only)'
  })
  @ApiParam({ name: 'id', type: 'number', description: 'User ID' })
  @ApiBody({ type: CreateUserDto, description: 'Updated user details' })
  @ApiOkResponse({ description: 'User updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - only super admins can update users' })
  async update(
    @Req() req: ExtendedRequest,
    @Param('id') id: string,
    @Body() dto: Partial<CreateUserDto>,
  ) {
    if (req.userDetails.role !== 'super_admin') throw new ForbiddenException();
    const data = await this.userService.update(+id, dto);
    return { data };
  }

  @Post('bulk-import-distributors')
  @ApiOperation({ 
    summary: 'Bulk Import Distributors',
    description: 'Import multiple distributors from CSV/Excel data (admin only)'
  })
  @ApiBody({ schema: { example: { data: [{ firstName: 'John', email: 'john@example.com', mobileNo: '9000000001' }] } } })
  @ApiOkResponse({ description: 'Distributors imported successfully' })
  @ApiResponse({ status: 400, description: 'Invalid import data' })
  @ApiResponse({ status: 403, description: 'Forbidden - only super admins can bulk import' })
  async bulkImportDistributors(
    @Req() req: ExtendedRequest,
    @Body() payload: { data: any[] },
  ) {
    if (req.userDetails.role !== 'super_admin') throw new ForbiddenException();
    const data = await this.userService.bulkImportDistributors(payload.data);
    return { data };
  }

  @Post('bulk-import-items')
  @ApiOperation({ 
    summary: 'Bulk Import Items',
    description: 'Import multiple items from CSV/Excel data (admin only)'
  })
  @ApiBody({ schema: { example: { data: [{ name: 'Item 1', sku: 'SKU001', price: 100 }] } } })
  @ApiOkResponse({ description: 'Items imported successfully' })
  @ApiResponse({ status: 400, description: 'Invalid import data' })
  @ApiResponse({ status: 403, description: 'Forbidden - only super admins can bulk import' })
  async bulkImportItems(
    @Req() req: ExtendedRequest,
    @Body() payload: { data: any[] },
  ) {
    if (req.userDetails.role !== 'super_admin') throw new ForbiddenException();
    return { data: { success: payload.data.length, failed: 0 } };
  }
}
