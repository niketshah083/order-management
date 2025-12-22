import { Controller, Get, Post, Body, Patch, Param, Delete, Req, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiBody, ApiParam, ApiOkResponse } from '@nestjs/swagger';
import { InternalUsersService } from './internal-users.service';
import { CreateInternalUserDto } from './dto/create-internal-user.dto';
import { ExtendedRequest } from 'src/common/middleware/jwt.middleware';

@ApiBearerAuth('authorization')
@ApiTags('Internal Users')
@Controller('internal-users')
export class InternalUsersController {
  constructor(private readonly internalUsersService: InternalUsersService) {}

  @Post()
  @ApiOperation({ 
    summary: 'Create Internal User',
    description: 'Create a new internal user (admin, manager, etc.) - admin only'
  })
  @ApiBody({ type: CreateInternalUserDto, description: 'Internal user details' })
  @ApiOkResponse({ description: 'Internal user created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid user data' })
  @ApiResponse({ status: 403, description: 'Forbidden - only super admins can create internal users' })
  async create(@Req() req: ExtendedRequest, @Body() createInternalUserDto: CreateInternalUserDto) {
    if (req.userDetails.role !== 'super_admin') {
      throw new ForbiddenException('Only super admin can create internal users');
    }
    const internalUser = await this.internalUsersService.create(createInternalUserDto);
    return { statusCode: 201, data: internalUser };
  }

  @Get()
  @ApiOperation({ 
    summary: 'Get All Internal Users',
    description: 'Retrieve list of all internal users (managers and admins only)'
  })
  @ApiOkResponse({ description: 'Internal users retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - access denied' })
  async findAll(@Req() req: ExtendedRequest) {
    if (!['super_admin', 'manager'].includes(req.userDetails.role)) {
      throw new ForbiddenException('Access denied');
    }
    const internalUsers = await this.internalUsersService.findAll();
    return { statusCode: 200, data: internalUsers };
  }

  @Get(':id')
  @ApiOperation({ 
    summary: 'Get Internal User Details',
    description: 'Retrieve details of a specific internal user'
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Internal User ID' })
  @ApiOkResponse({ description: 'Internal user retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Internal user not found' })
  async findOne(@Param('id') id: string) {
    const internalUser = await this.internalUsersService.findOne(+id);
    return { statusCode: 200, data: internalUser };
  }

  @Patch(':id')
  @ApiOperation({ 
    summary: 'Update Internal User',
    description: 'Update internal user details (admin only)'
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Internal User ID' })
  @ApiBody({ type: CreateInternalUserDto, description: 'Updated internal user details' })
  @ApiOkResponse({ description: 'Internal user updated successfully' })
  @ApiResponse({ status: 404, description: 'Internal user not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - only super admins can update internal users' })
  async update(
    @Req() req: ExtendedRequest,
    @Param('id') id: string,
    @Body() updateInternalUserDto: Partial<CreateInternalUserDto>,
  ) {
    if (req.userDetails.role !== 'super_admin') {
      throw new ForbiddenException('Only super admin can update internal users');
    }
    const internalUser = await this.internalUsersService.update(+id, updateInternalUserDto);
    return { statusCode: 200, data: internalUser };
  }

  @Delete(':id')
  @ApiOperation({ 
    summary: 'Delete Internal User',
    description: 'Delete an internal user (admin only)'
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Internal User ID' })
  @ApiOkResponse({ description: 'Internal user deleted successfully' })
  @ApiResponse({ status: 404, description: 'Internal user not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - only super admins can delete internal users' })
  async remove(@Req() req: ExtendedRequest, @Param('id') id: string) {
    if (req.userDetails.role !== 'super_admin') {
      throw new ForbiddenException('Only super admin can delete internal users');
    }
    const result = await this.internalUsersService.remove(+id);
    return { statusCode: 200, data: result };
  }
}
