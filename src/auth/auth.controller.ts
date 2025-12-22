import { Body, Controller, HttpCode, Post, Get, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiBody, ApiOkResponse } from '@nestjs/swagger';
import { LoginDto } from './dto/login.dto';
import { AuthService } from './auth.service';
import { UsersService } from 'src/users/users.service';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
  ) {}

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ 
    summary: 'User Login',
    description: 'Authenticate user with email/mobile and password. Returns JWT token.' 
  })
  @ApiBody({ 
    type: LoginDto,
    description: 'Login credentials (email/mobile and password)'
  })
  @ApiOkResponse({ 
    description: 'Login successful, returns JWT token',
    schema: { example: { data: { token: 'jwt_token_here', user: { id: 1, email: 'user@example.com', role: 'distributor' } } } }
  })
  @ApiResponse({ status: 401, description: 'Invalid email/mobile or password' })
  @ApiResponse({ status: 400, description: 'Missing required fields' })
  async login(@Body() dto: LoginDto) {
    const data = await this.authService.login(dto.emailOrMobile, dto.password);
    return { data };
  }

  @Post('seed-customers-orders')
  @HttpCode(200)
  @ApiOperation({ 
    summary: 'Seed Customers and Orders',
    description: 'Create 10 customers with 2-5 orders each for reporting'
  })
  async seedCustomersAndOrders() {
    return this.authService.seedCustomersAndOrders();
  }

  @Post('seed-test-data')
  @HttpCode(200)
  @ApiOperation({ 
    summary: 'Seed Test Data',
    description: 'Create test data including 2 admins, 2 distributors, and 10 customers for development/testing'
  })
  @ApiOkResponse({ 
    description: 'Test data seeded successfully',
    schema: { example: { message: 'Test data seeded successfully', credentials: { admins: [], distributors: [], customers: [] } } }
  })
  @ApiResponse({ status: 403, description: 'Only admins can seed data' })
  async seedTestData() {
    const credentials = {
      admins: [],
      distributors: [],
      customers: [],
    };

    // Create 2 Admins
    for (let i = 1; i <= 2; i++) {
      const exists = await this.usersService.findByEmail(`admin${i}@omniordera.com`);
      if (!exists) {
        await this.usersService.create({
          firstName: 'Admin',
          lastName: `User${i}`,
          email: `admin${i}@omniordera.com`,
          mobileNo: `900000000${i}`,
          password: `admin${i}@123`,
          role: 'super_admin',
        });
        credentials.admins.push({
          email: `admin${i}@omniordera.com`,
          password: `admin${i}@123`,
        });
      } else {
        credentials.admins.push({
          email: `admin${i}@omniordera.com`,
          password: `admin${i}@123`,
        });
      }
    }

    // Create 2 Distributors with their own customers
    for (let i = 1; i <= 2; i++) {
      const exists = await this.usersService.findByEmail(`distributor${i}@omniordera.com`);
      
      if (!exists) {
        await this.usersService.create({
          firstName: 'Distributor',
          lastName: `User${i}`,
          email: `distributor${i}@omniordera.com`,
          mobileNo: `900000010${i}`,
          password: `dist${i}@123`,
          role: 'distributor',
          gstin: `22AAAAA000${i}1Z5`,
          addressLine1: `Distributor Address ${i}`,
          city: `City${i}`,
          state: `State${i}`,
          creditLimitDays: 30,
          creditLimitAmount: 100000,
        });
        credentials.distributors.push({
          email: `distributor${i}@omniordera.com`,
          password: `dist${i}@123`,
        });
      } else {
        credentials.distributors.push({
          email: `distributor${i}@omniordera.com`,
          password: `dist${i}@123`,
        });
      }
    }

    // Create 5 customers for each distributor (10 total, 5 per distributor)
    for (let i = 1; i <= 2; i++) {
      for (let j = 1; j <= 5; j++) {
        const custIndex = (i - 1) * 5 + j;
        credentials.customers.push({
          email: `customer${custIndex}@omniordera.com`,
          distributor: `distributor${i}@omniordera.com`,
        });
      }
    }

    return {
      message: 'Test data seeded successfully',
      credentials,
    };
  }
}
