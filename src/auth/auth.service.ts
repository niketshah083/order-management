import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { CustomerEntity } from '../customers/entities/customer.entity';
import { OrderEntity } from '../orders/entities/order.entity';
import { UserEntity } from '../users/entities/user.entity';
import { EDeliveryWindow } from '../common/interface/common.interface';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    @InjectRepository(CustomerEntity)
    private customerRepo: Repository<CustomerEntity>,
    @InjectRepository(OrderEntity)
    private orderRepo: Repository<OrderEntity>,
    @InjectRepository(UserEntity)
    private userRepo: Repository<UserEntity>,
  ) {}

  async validateUser(emailOrMobile: string, password: string) {
    let user = await this.usersService.findByEmail(emailOrMobile);
    if (!user) {
      user = await this.usersService.findByMobile(emailOrMobile);
    }

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const match = await bcrypt.compare(password, user.password);
    if (!match) throw new UnauthorizedException('Invalid credentials');
    return user;
  }

  async login(emailOrMobile: string, password: string) {
    const user = await this.validateUser(emailOrMobile, password);
    const secret = process.env.JWT_SECRET || 'replace_with_strong_secret';
    const token = jwt.sign({ id: user.id, role: user.role }, secret, {
      expiresIn: '7D',
    });
    return { accessToken: token };
  }

  async seedCustomersAndOrders() {
    // Fetch all distributor users from database
    const distributors = await this.userRepo.find({
      where: { role: 'distributor' },
    });

    if (distributors.length === 0) {
      return {
        message: 'No distributors found in database',
        error: 'Please create at least one distributor before seeding customers',
      };
    }

    // Map distributors for load distribution
    const distributorIds = distributors.map(d => d.id);

    // 10 Customers with pincode mapping - assign distributors dynamically
    const customersData = [
      { firstname: 'Rajesh', lastname: 'Sharma', mobileNo: '9001001001', emailId: 'rajesh.sharma@email.com', addressLine1: '123 MG Road', city: 'Delhi', state: 'Delhi', pincode: '110001', distributorId: distributorIds[0 % distributorIds.length] },
      { firstname: 'Priya', lastname: 'Verma', mobileNo: '9001001002', emailId: 'priya.verma@email.com', addressLine1: '456 Connaught Place', city: 'Delhi', state: 'Delhi', pincode: '110002', distributorId: distributorIds[0 % distributorIds.length] },
      { firstname: 'Amit', lastname: 'Patel', mobileNo: '9001001003', emailId: 'amit.patel@email.com', addressLine1: '789 Marine Drive', city: 'Mumbai', state: 'Maharashtra', pincode: '400001', distributorId: distributorIds[1 % distributorIds.length] },
      { firstname: 'Sneha', lastname: 'Desai', mobileNo: '9001001004', emailId: 'sneha.desai@email.com', addressLine1: '101 Bandra Kurla', city: 'Mumbai', state: 'Maharashtra', pincode: '400002', distributorId: distributorIds[1 % distributorIds.length] },
      { firstname: 'Vikram', lastname: 'Singh', mobileNo: '9001001005', emailId: 'vikram.singh@email.com', addressLine1: '202 Corporate Park', city: 'Ahmedabad', state: 'Gujarat', pincode: '380001', distributorId: distributorIds[0 % distributorIds.length] },
      { firstname: 'Anjali', lastname: 'Gupta', mobileNo: '9001001006', emailId: 'anjali.gupta@email.com', addressLine1: '303 Thaltej Road', city: 'Ahmedabad', state: 'Gujarat', pincode: '380002', distributorId: distributorIds[0 % distributorIds.length] },
      { firstname: 'Suresh', lastname: 'Kumar', mobileNo: '9001001007', emailId: 'suresh.kumar@email.com', addressLine1: '404 GIDC Estate', city: 'Surat', state: 'Gujarat', pincode: '395001', distributorId: distributorIds[1 % distributorIds.length] },
      { firstname: 'Meera', lastname: 'Nair', mobileNo: '9001001008', emailId: 'meera.nair@email.com', addressLine1: '505 Mag Road', city: 'Surat', state: 'Gujarat', pincode: '395002', distributorId: distributorIds[1 % distributorIds.length] },
      { firstname: 'Arjun', lastname: 'Rao', mobileNo: '9001001009', emailId: 'arjun.rao@email.com', addressLine1: '606 Rajkot Junction', city: 'Rajkot', state: 'Gujarat', pincode: '360001', distributorId: distributorIds[0 % distributorIds.length] },
      { firstname: 'Divya', lastname: 'Iyer', mobileNo: '9001001010', emailId: 'divya.iyer@email.com', addressLine1: '707 Harihar Road', city: 'Rajkot', state: 'Gujarat', pincode: '360002', distributorId: distributorIds[0 % distributorIds.length] },
    ];

    // Create customers
    const customers = [];
    for (const custData of customersData) {
      const exists = await this.customerRepo.findOne({ where: { mobileNo: custData.mobileNo } });
      if (!exists) {
        const customer = this.customerRepo.create(custData);
        const saved = await this.customerRepo.save(customer);
        customers.push(saved);
      } else {
        customers.push(exists);
      }
    }

    // Create 3-5 orders per customer
    const orders = [];
    const orderDates = [
      '2025-11-25', '2025-11-20', '2025-11-15', '2025-11-10', '2025-11-05',
      '2025-10-30', '2025-10-25', '2025-10-20', '2025-10-15', '2025-10-10',
      '2025-09-30', '2025-09-20', '2025-09-10', '2025-08-30', '2025-08-15',
    ];
    
    let dateIdx = 0;
    for (let i = 0; i < customers.length; i++) {
      const numOrders = i % 2 === 0 ? 4 : 3; // Alternate 4 and 3 orders
      for (let j = 0; j < numOrders; j++) {
        const orderNo = `ORD-${String(i + 1).padStart(2, '0')}-${String(j + 1).padStart(2, '0')}`;
        const totalAmount = 3000 + Math.random() * 7000; // Random between 3000-10000
        
        const orderExists = await this.orderRepo.findOne({ where: { orderNo } });
        if (!orderExists) {
          const order = this.orderRepo.create({
            customerId: customers[i].id,
            orderNo,
            status: 'COMPLETED',
            totalAmount: parseFloat(totalAmount.toFixed(2)),
            paymentStatus: 'PAID',
            deliveryWindow: EDeliveryWindow.MORNING,
          });
          const saved = await this.orderRepo.save(order);
          orders.push(saved);
          dateIdx++;
        }
      }
    }

    return {
      message: 'Customers and Orders seeded successfully',
      customersCreated: customers.length,
      ordersCreated: orders.length,
      distributorsUsed: distributorIds.length,
      summary: `Created ${customers.length} customers with ${orders.length} total orders across ${new Set(customers.map(c => c.city)).size} cities using ${distributorIds.length} active distributor(s)`,
    };
  }
}
