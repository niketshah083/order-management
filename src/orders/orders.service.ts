import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { OrderEntity } from './entities/order.entity';
import { OrderItemEntity } from './entities/order-item.entity';
import { ItemEntity } from 'src/items/entities/item.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { responseMessage } from 'src/common/utilities/responseMessages.utils';
import { CommonConstants } from 'src/common/constants/common.constant';
import moment from 'moment';
import { EDeliveryWindow } from 'src/common/interface/common.interface';
import { Request, Response } from 'express';
import { EncryptionUtils } from 'src/common/utilities/encryption.utils';
import { UserEntity } from 'src/users/entities/user.entity';
import { ExtendedRequest } from 'src/common/middleware/jwt.middleware';
import { CompleteOrdersDto } from './dto/complete-orders.dto';
import { DistributorEntity } from 'src/users/entities/distributor.entity';
import { CustomerEntity } from 'src/customers/entities/customer.entity';
import { DataAccessControlService } from 'src/common/services/data-access-control.service';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(OrderEntity) private orderRepo: Repository<OrderEntity>,
    @InjectRepository(OrderItemEntity)
    private orderItemRepo: Repository<OrderItemEntity>,
    @InjectRepository(ItemEntity) private itemRepo: Repository<ItemEntity>,
    @InjectRepository(UserEntity) private userRepo: Repository<UserEntity>,
    @InjectRepository(DistributorEntity) private distributorRepo: Repository<DistributorEntity>,
    @InjectRepository(CustomerEntity) private customerRepo: Repository<CustomerEntity>,
    private dataAccessControl: DataAccessControlService,
  ) {}

  async findAll(req: ExtendedRequest, search?: string) {
    const userRole = req.userDetails.role;
    const userId = req.userDetails.userId;

    const queryBuilder = this.orderRepo
      .createQueryBuilder('order')
      .leftJoin('order.createdByUser', 'createdByUser')
      .leftJoin('order.updatedByUser', 'updatedByUser')
      .leftJoin('order.customer', 'customer')
      .select([
        'order.id',
        'order.orderNo',
        'order.totalAmount',
        'order.deliveryWindow',
        'order.status',
        'order.paymentStatus',
        'order.createdAt',
        'order.updatedAt',
        'createdByUser.id as createdByUserId',
        'createdByUser.firstName as createdByUserFirstName',
        'createdByUser.lastName as createdByUserLastName',
        'updatedByUser.id as updatedByUserId',
        'updatedByUser.firstName as updatedByUserFirstName',
        'updatedByUser.lastName as updatedByUserLastName',
        'customer.id as customerId',
        'customer.firstName as customerFirstName',
        'customer.lastName as customerLastName',
      ]);

    // Role-based filtering using centralized data access control
    try {
      const authorizedDistributorIds = await this.dataAccessControl.getAuthorizedDistributorIds(
        userId,
        userRole,
      );

      // If super_admin: authorizedDistributorIds is null (see all)
      // If distributor/manager: authorizedDistributorIds is array
      if (authorizedDistributorIds !== null) {
        // Filter orders through customer's distributor ID
        queryBuilder.andWhere(
          'customer.distributorId IN (:...distributorIds)',
          { distributorIds: authorizedDistributorIds }
        );
      }
      // For super_admin: no WHERE clause (see all)
    } catch (error) {
      // If user doesn't have proper permissions, return empty
      return { data: [], totalCount: 0 };
    }

    if (search) {
      queryBuilder.andWhere(
        '(order.orderNo LIKE :search OR order.specialInstructions LIKE :search)',
        { search: `%${search}%` }
      );
    }

    // Sort by created date descending (newest first)
    queryBuilder.orderBy('order.createdAt', 'DESC');

    const [data, totalCount] = await queryBuilder.getManyAndCount();
    return { data, totalCount };
  }

  async findOne(id: number) {
    const o = await this.orderRepo.findOne({ where: { id } });
    if (!o) throw new BadRequestException('Order not found');
    const items = await this.orderItemRepo.find({ where: { orderId: id } });
    return { ...o, items };
  }

  async create(dto: CreateOrderDto, userId: number) {
    const deliveryWindow = this.getDeliveryWindow();
    if (deliveryWindow === EDeliveryWindow.NONE) {
      throw new BadRequestException(
        'You are not allowed to create order right now!, please come back in next morning or evening',
      );
    }

    // -----------------------------------------
    // 🔍 CHECK CREDIT LIMITS (From Customer Master)
    // -----------------------------------------
    let creditWarning = null;
    // TODO: Implement credit validation by fetching customer master linked to this user
    // This will check both creditLimitDays and creditLimitAmount against the order amount
    // and set creditWarning if limits are exceeded

    // -----------------------------------------
    // 🔍 CHECK IF USER ALREADY HAS ORDER TODAY IN SAME WINDOW
    // -----------------------------------------
    const today = moment().format('YYYY-MM-DD');

    const startOfDay = new Date(`${today} 00:00:00`);
    const endOfDay = new Date(`${today} 23:59:59`);
    
    const existingOrder = await this.orderRepo.findOne({
      where: {
        customerId: userId,
        deliveryWindow,
        status: 'pending',
        createdAt: Between(startOfDay, endOfDay),
      },
    });

    // -----------------------------------------
    // 🔍 Fetch all required items for rate calculation
    // -----------------------------------------
    const itemIdSet = new Set(dto.items.map((e) => e.itemId));

    const items = await this.itemRepo.find({
      where: { id: In([...itemIdSet]) },
    });

    if (items.length !== itemIdSet.size) {
      throw new NotFoundException(
        responseMessage.notFoundMessage('One of the item'),
      );
    }
    // -----------------------------------------
    // 🎯 CASE 1: UPDATE EXISTING ORDER (MERGE ITEMS)
    // -----------------------------------------
    if (existingOrder) {
      const oldItems = await this.orderItemRepo.find({
        where: { orderId: existingOrder.id },
      });

      const newItemMap = new Map<number, number>();
      dto.items.forEach((i) => {
        newItemMap.set(i.itemId, i.qty);
      });

      // Build final merged item list
      const mergedItemsMap = new Map<number, { qty: number; rate: number }>();

      // 1️⃣ Add old items first
      oldItems.forEach((oi) => {
        mergedItemsMap.set(oi.itemId, {
          qty: oi.qty,
          rate: oi.rate,
        });
      });

      // 2️⃣ Add new items (merge qty if exists)
      dto.items.forEach((ni) => {
        const info = items.find((x) => x.id === ni.itemId);
        const old = mergedItemsMap.get(ni.itemId);

        mergedItemsMap.set(ni.itemId, {
          qty: (old?.qty || 0) + ni.qty,
          rate: info?.rate || 0,
        });
      });

      // 3️⃣ Recalculate total
      let total = 0;
      const mergedItems = [];

      mergedItemsMap.forEach((value, key) => {
        const amount = value.qty * value.rate;
        total += amount;

        const dtoItem = dto.items.find(i => i.itemId === key);
        mergedItems.push({
          orderId: existingOrder.id,
          itemId: key,
          qty: value.qty,
          rate: value.rate,
          amount,
          orderedByBox: dtoItem?.orderedByBox || false,
          boxCount: dtoItem?.boxCount || 0,
          boxRate: dtoItem?.orderedByBox ? value.rate : null,
        });
      });

      // Update main order
      existingOrder.totalAmount = total;
      existingOrder.updatedBy = userId;

      await this.orderRepo.save(existingOrder);

      // Remove old items and store merged items
      await this.orderItemRepo.delete({ orderId: existingOrder.id });
      await this.orderItemRepo.save(mergedItems);

      return this.findOne(existingOrder.id);
    }

    // -----------------------------------------
    // 🎯 CASE 2: CREATE NEW ORDER
    // -----------------------------------------
    const orderNo = `ORD-${Date.now()}`;
    let total = 0;

    dto.items.forEach((it) => {
      const itemInfo = items.find((item) => item.id === it.itemId);
      if (it.orderedByBox && it.boxCount) {
        total += it.boxCount * (itemInfo?.boxRate || 0);
      } else {
        total += it.qty * (itemInfo?.rate || 0);
      }
    });

    const order = this.orderRepo.create({
      orderNo,
      deliveryWindow,
      status: 'pending',
      customerId: userId,
      totalAmount: total,
      createdBy: userId,
    });

    const saved = await this.orderRepo.save(order);

    await Promise.all(
      dto.items.map(async (it) => {
        const info = items.find((x) => x.id === it.itemId);
        let amount = 0;
        let finalQty = it.qty;

        if (it.orderedByBox && it.boxCount) {
          amount = it.boxCount * (info?.boxRate || 0);
          finalQty = it.boxCount * (info?.unitsPerBox || 1);
        } else {
          amount = it.qty * (info?.rate || 0);
        }

        const oi = this.orderItemRepo.create({
          orderId: saved.id,
          itemId: it.itemId,
          qty: finalQty,
          rate: it.orderedByBox ? (info?.boxRate || 0) : (info?.rate || 0),
          amount,
          orderedByBox: it.orderedByBox || false,
          boxCount: it.boxCount || 0,
          boxRate: it.orderedByBox ? (info?.boxRate || 0) : null,
        });
        await this.orderItemRepo.save(oi);
      }),
    );

    return this.findOne(saved.id);
  }

  async update(id: number, dto: CreateOrderDto, userId: number) {
    const ord = await this.orderRepo.findOne({ where: { id } });
    if (!ord) throw new BadRequestException('Order not found');

    // Fetch item rates for recalculation
    const itemIdSet = new Set(dto.items.map((i) => i.itemId));
    const items = await this.itemRepo.find({
      where: { id: In([...itemIdSet]) },
    });

    // Recalculate total
    let total = 0;
    dto.items.forEach((it) => {
      const info = items.find((x) => x.id === it.itemId);
      if (it.orderedByBox && it.boxCount) {
        total += it.boxCount * (info?.boxRate || 0);
      } else {
        total += it.qty * (info?.rate || 0);
      }
    });

    // Update main order
    ord.customerId = userId;
    ord.totalAmount = total;
    ord.updatedBy = userId;

    await this.orderRepo.save(ord);

    // Remove existing items
    await this.orderItemRepo.delete({ orderId: id });

    // Insert updated items
    await Promise.all(
      dto.items.map(async (it) => {
        const info = items.find((x) => x.id === it.itemId);
        let amount = 0;
        let finalQty = it.qty;

        if (it.orderedByBox && it.boxCount) {
          amount = it.boxCount * (info?.boxRate || 0);
          finalQty = it.boxCount * (info?.unitsPerBox || 1);
        } else {
          amount = it.qty * (info?.rate || 0);
        }

        const oi = this.orderItemRepo.create({
          orderId: id,
          itemId: it.itemId,
          qty: finalQty,
          rate: it.orderedByBox ? (info?.boxRate || 0) : (info?.rate || 0),
          amount,
          orderedByBox: it.orderedByBox || false,
          boxCount: it.boxCount || 0,
          boxRate: it.orderedByBox ? (info?.boxRate || 0) : null,
        });
        await this.orderItemRepo.save(oi);
      }),
    );

    return this.findOne(id);
  }

  async completeOrders(completeOrdersDto: CompleteOrdersDto, userId: number) {
    const { ids } = completeOrdersDto;
    // Fetch all orders in one query
    const orders = await this.orderRepo.find({
      where: { id: In(ids) },
    });

    if (!orders.length) {
      throw new BadRequestException(responseMessage.notFoundMessage('Orders'));
    }

    // Validate missing orders
    const foundIds = orders.map((o) => o.id);
    const missingIds = ids.filter((x) => !foundIds.includes(x));

    if (missingIds.length) {
      throw new BadRequestException(
        `Orders not found: ${missingIds.join(', ')}`,
      );
    }

    // Check already completed orders
    const alreadyCompleted = orders.filter((o) => o.status === 'completed');
    if (alreadyCompleted.length) {
      throw new BadRequestException(
        `Already completed orders: ${alreadyCompleted.map((o) => o.id).join(', ')}`,
      );
    }

    // Update all orders
    orders.forEach((o) => {
      o.status = 'completed';
      o.updatedBy = userId;
    });

    await this.orderRepo.save(orders);

    // Return updated orders
    return this.orderRepo.find({
      where: { id: In(ids) },
    });
  }

  getCurrentWindow(): EDeliveryWindow {
    const now = moment.tz('Asia/Kolkata');

    // Morning window
    const morningStart = moment.tz(
      CommonConstants.ORDER_APPROVAL_TIMING.MORNING[0],
      'h:mm A',
      'Asia/Kolkata',
    );
    const morningEnd = moment.tz(
      CommonConstants.ORDER_APPROVAL_TIMING.MORNING[1],
      'h:mm A',
      'Asia/Kolkata',
    );

    // Evening window
    const eveningStart = moment.tz(
      CommonConstants.ORDER_APPROVAL_TIMING.EVENING[0],
      'h:mm A',
      'Asia/Kolkata',
    );
    const eveningEnd = moment.tz(
      CommonConstants.ORDER_APPROVAL_TIMING.EVENING[1],
      'h:mm A',
      'Asia/Kolkata',
    );

    if (now.isBetween(morningStart, morningEnd, null, '[)')) {
      return EDeliveryWindow.MORNING;
    }

    if (now.isBetween(eveningStart, eveningEnd, null, '[)')) {
      return EDeliveryWindow.EVENING;
    }

    return EDeliveryWindow.NONE;
  }

  getDeliveryWindow(): EDeliveryWindow {
    const currentWindow = this.getCurrentWindow();
    if (currentWindow === EDeliveryWindow.MORNING) {
      return EDeliveryWindow.EVENING;
    }

    if (currentWindow === EDeliveryWindow.EVENING) {
      return EDeliveryWindow.MORNING;
    }
    return EDeliveryWindow.NONE;
  }

  async processWhatsappData(body: any, req: Request, res: Response) {
    const { decryptedBody, aesKeyBuffer, initialVectorBuffer } =
      await EncryptionUtils.decryptRequest(body, process.env.PRIVATE_KEY);

    const { screen, data, version, action, flow_token } = decryptedBody;
    console.log({ screen, data, version, action, flow_token });

    if (action === 'ping') {
      const pingResponse = { data: { status: 'active' } };
      return EncryptionUtils.encryptResponse(
        pingResponse,
        aesKeyBuffer,
        initialVectorBuffer,
      );
    } else if (action === 'INIT') {
      const items = await this.itemRepo.find({ where: {} });
      const ORDER_ITEMS = {};
      items.forEach((it, index) => {
        ORDER_ITEMS[`item${index + 1}`] = `${it.name}~(₹${it.rate})`;
      });
      const SCREEN_RESPONSES = {
        screen: 'ORDER',
        data: {
          ...ORDER_ITEMS,
        },
      };
      // Return the response as plaintext
      return EncryptionUtils.encryptResponse(
        SCREEN_RESPONSES,
        aesKeyBuffer,
        initialVectorBuffer,
      );
    } else if (action === 'data_exchange') {
      const mobileNo = flow_token.split('~')?.[1];
      const user = await this.userRepo.findOne({ where: { mobileNo } });
      if (user) {
        // Return the next screen & data to the client
        const items = {};
        Object.keys(data)
          .filter((key) => !key.endsWith('Qty'))
          .map((key) => {
            items[data[key].split('~')[0]] = +data[`${key}Qty`] || 0;
          });

        const itemNames = Object.keys(items);
        const itemList = await this.itemRepo.find({
          where: { name: In(itemNames) },
        });
        const obj: CreateOrderDto = {
          customerId: user.id,
          items: itemList
            .map((it) => ({
              itemId: it.id,
              qty: items[it.name],
            }))
            .filter((it) => it.qty),
        };
        console.log('obj :: ', obj);
        const order = await this.create(obj, user.id);
        console.log('order :: ', order);
        const SCREEN_RESPONSES = {
          screen: 'SUCCESS',
          data: {
            extension_message_response: {
              params: {
                order_number: order.orderNo,
              },
            },
          },
        };
        return EncryptionUtils.encryptResponse(
          SCREEN_RESPONSES,
          aesKeyBuffer,
          initialVectorBuffer,
        );
      } else {
        console.log('User not found :: ');
      }
    }
  }

  async fetchLastFivePendingOrders() {
    const orders = await this.orderRepo.find({
      take: 5,
      order: { id: 'desc' },
    });
    return orders;
  }

  async fetchOrderInfoByOrderNo(orderNo: string) {
    const orders = await this.orderRepo.findOne({
      where: { orderNo },
      relations: { orderItems: { item: true }, customer: true },
    });
    return orders;
  }

}
