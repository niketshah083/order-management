import {
  Controller,
  Get,
  Query,
  Req,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiOkResponse,
} from '@nestjs/swagger';
import { InventoryLotEntity } from './entities/inventory-lot.entity';
import { InventoryTransactionEntity } from './entities/inventory-transaction.entity';
import { BillingEntity } from '../billing/entities/billing.entity';
import { GrnEntity } from '../orders/entities/grn.entity';
import { UserEntity } from '../users/entities/user.entity';
import { DistributorEntity } from '../users/entities/distributor.entity';
import { ItemEntity } from '../items/entities/item.entity';
import { ExtendedRequest } from '../common/middleware/jwt.middleware';
import { InventoryCoreService } from './inventory-core.service';

@ApiTags('Product Trace')
@Controller('product-trace')
export class ProductTraceController {
  constructor(
    @InjectRepository(InventoryLotEntity)
    private lotRepo: Repository<InventoryLotEntity>,
    @InjectRepository(InventoryTransactionEntity)
    private transactionRepo: Repository<InventoryTransactionEntity>,
    @InjectRepository(BillingEntity)
    private billingRepo: Repository<BillingEntity>,
    @InjectRepository(GrnEntity)
    private grnRepo: Repository<GrnEntity>,
    @InjectRepository(UserEntity)
    private userRepo: Repository<UserEntity>,
    @InjectRepository(DistributorEntity)
    private distributorRepo: Repository<DistributorEntity>,
    @InjectRepository(ItemEntity)
    private itemRepo: Repository<ItemEntity>,
    @Inject(forwardRef(() => InventoryCoreService))
    private inventoryCoreService: InventoryCoreService,
  ) {}

  @Get('trace')
  @ApiOperation({
    summary: 'Trace Product by Batch or Item Code',
    description: 'Get complete history of a product',
  })
  @ApiQuery({
    name: 'batchCode',
    required: false,
    description: 'Batch number to search',
  })
  @ApiQuery({
    name: 'itemCode',
    required: false,
    description: 'Item code/ID to search',
  })
  @ApiOkResponse({ description: 'Product trace data retrieved successfully' })
  async traceProduct(
    @Query('batchCode') batchCode?: string,
    @Query('itemCode') itemCode?: string,
    @Req() req?: ExtendedRequest,
  ) {
    const userId = req?.userDetails?.userId;
    const userRole = req?.userDetails?.role;

    try {
      let results: any[] = [];

      if (batchCode) {
        results = await this.traceBatch(batchCode, userId, userRole, userId);
      } else if (itemCode) {
        results = await this.traceItem(itemCode, userId, userRole, userId);
      } else {
        return { data: [], message: 'Please provide batchCode or itemCode' };
      }

      return { data: results, message: 'Product trace retrieved successfully' };
    } catch (error) {
      console.error('Product trace error:', error);
      return { data: [], error: 'Error retrieving product trace' };
    }
  }

  private async traceBatch(
    batchCode: string,
    userId?: number,
    userRole?: string,
    userDistributorId?: number | null,
  ) {
    // ENTERPRISE INVENTORY: Use inventory_lot instead of batch_details
    let query = this.lotRepo
      .createQueryBuilder('lot')
      .leftJoinAndSelect('lot.item', 'item')
      .where('lot.lotNumber LIKE :batchCode', { batchCode: `%${batchCode}%` });

    // Data isolation: Distributors see only their batches, admins see all
    if (userRole === 'distributor' && userDistributorId) {
      query = query.andWhere('lot.distributorId = :distributorId', {
        distributorId: userDistributorId,
      });
    }

    const lots = await query.getMany();

    const trace = await Promise.all(
      lots.map(async (lot) => {
        // Calculate available quantity from transactions
        const quantityResult = await this.transactionRepo
          .createQueryBuilder('t')
          .select(
            `SUM(CASE 
            WHEN t.movementType = 'IN' THEN t.quantity
            WHEN t.movementType = 'OUT' THEN -t.quantity
            WHEN t.movementType = 'RESERVE' THEN -t.quantity
            WHEN t.movementType = 'RELEASE' THEN t.quantity
            ELSE 0 
          END)`,
            'quantity',
          )
          .where('t.lotId = :lotId', { lotId: lot.id })
          .andWhere('t.status = :status', { status: 'COMPLETED' })
          .getRawOne();

        const currentQuantity = Number(quantityResult?.quantity) || 0;

        // Get GRN info for this lot
        const grnTransaction = await this.transactionRepo
          .createQueryBuilder('t')
          .where('t.lotId = :lotId', { lotId: lot.id })
          .andWhere('t.transactionType = :type', { type: 'GRN_RECEIPT' })
          .andWhere('t.referenceType = :refType', { refType: 'GRN' })
          .orderBy('t.createdAt', 'ASC')
          .getOne();

        let grnInfo = null;
        if (grnTransaction?.referenceId) {
          const grn = await this.grnRepo.findOne({
            where: { id: grnTransaction.referenceId },
            relations: ['createdByUser'],
          });
          if (grn) {
            grnInfo = {
              grnNo: grn.grnNo,
              createdAt: grn.createdAt,
              approvedAt: grn.approvedAt || null,
              approvedByUser: grn.approvedBy
                ? grn.createdByUser?.firstName
                : null,
              status: grn.status,
            };
          }
        }

        // Get billings for this batch by joining with billing_items table
        let billingQuery = this.billingRepo
          .createQueryBuilder('b')
          .leftJoinAndSelect('b.customer', 'customer')
          .leftJoinAndSelect('b.distributor', 'distributor')
          .leftJoinAndSelect('b.billingItems', 'bi')
          .where('bi.batchNumber = :batchNumber', {
            batchNumber: lot.lotNumber,
          })
          .orderBy('b.billDate', 'DESC');

        // Data isolation: Distributors see only their billings
        if (userRole === 'distributor' && userDistributorId) {
          billingQuery = billingQuery.andWhere(
            'b.distributorId = :distributorId',
            { distributorId: userDistributorId },
          );
        }

        const billings = await billingQuery.getMany();

        // Calculate sold quantity from billing items
        let soldQuantity = 0;
        billings.forEach((b: any) => {
          const itemsInBilling =
            b.billingItems?.filter(
              (it: any) => it.batchNumber === lot.lotNumber,
            ) || [];
          soldQuantity += itemsInBilling.reduce(
            (s: number, it: any) => s + (parseFloat(it.quantity) || 0),
            0,
          );
        });

        // Check if batch is pending (not sold yet)
        const isPending = billings.length === 0;

        return {
          batchNumber: lot.lotNumber,
          itemId: lot.itemId,
          itemName: lot.item?.name || 'Unknown',
          quantity: currentQuantity,
          expiryDate: lot.expiryDate,
          createdAt: lot.createdAt,
          status: isPending ? 'PENDING' : 'SOLD',
          soldQuantity: soldQuantity,
          grnInfo,
          billings: billings.map((b) => {
            const itemsInBilling =
              b.billingItems?.filter(
                (it: any) => it.batchNumber === lot.lotNumber,
              ) || [];
            const quantityInBilling = itemsInBilling.reduce(
              (sum: number, it: any) => sum + (parseFloat(it.quantity) || 0),
              0,
            );

            return {
              billNo: b.billNo,
              customerId: b.customerId,
              customerName: b.customer
                ? `${b.customer.firstname} ${b.customer.lastname}`
                : 'Unknown',
              customerCity: b.customer?.city || 'N/A',
              quantitySold: quantityInBilling,
              amount: b.finalAmount,
              date: b.billDate,
              status: b.status,
            };
          }),
          pendingQuantity: currentQuantity,
        };
      }),
    );

    return trace;
  }

  private async traceItem(
    itemCode: string,
    userId?: number,
    userRole?: string,
    userDistributorId?: number | null,
  ) {
    // ENTERPRISE INVENTORY: Use inventory_transaction to find items with stock
    // Search for items by name or ID
    let itemQuery = this.itemRepo
      .createQueryBuilder('item')
      .where(
        'CAST(item.id AS CHAR) LIKE :itemCode OR LOWER(item.name) LIKE LOWER(:itemCode)',
        { itemCode: `%${itemCode}%` },
      );

    const items = await itemQuery.getMany();

    const trace = await Promise.all(
      items.map(async (item) => {
        // Get lots for this item
        let lotQuery = this.lotRepo
          .createQueryBuilder('lot')
          .where('lot.itemId = :itemId', { itemId: item.id });

        if (userRole === 'distributor' && userDistributorId) {
          lotQuery = lotQuery.andWhere('lot.distributorId = :distributorId', {
            distributorId: userDistributorId,
          });
        }

        const lots = await lotQuery.getMany();

        // Calculate total quantity from transactions
        let totalQuantityQuery = this.transactionRepo
          .createQueryBuilder('t')
          .select(
            `SUM(CASE 
            WHEN t.movementType = 'IN' THEN t.quantity
            WHEN t.movementType = 'OUT' THEN -t.quantity
            WHEN t.movementType = 'RESERVE' THEN -t.quantity
            WHEN t.movementType = 'RELEASE' THEN t.quantity
            ELSE 0 
          END)`,
            'quantity',
          )
          .where('t.itemId = :itemId', { itemId: item.id })
          .andWhere('t.status = :status', { status: 'COMPLETED' });

        if (userRole === 'distributor' && userDistributorId) {
          totalQuantityQuery = totalQuantityQuery.andWhere(
            't.distributorId = :distributorId',
            { distributorId: userDistributorId },
          );
        }

        const totalResult = await totalQuantityQuery.getRawOne();
        const totalQuantity = Number(totalResult?.quantity) || 0;

        // Get billings for this item
        let billingQuery = this.billingRepo
          .createQueryBuilder('b')
          .leftJoinAndSelect('b.customer', 'customer')
          .leftJoinAndSelect('b.distributor', 'distributor')
          .leftJoinAndSelect('b.billingItems', 'bi')
          .where('bi.itemId = :itemId', { itemId: item.id })
          .orderBy('b.billDate', 'DESC');

        if (userRole === 'distributor' && userDistributorId) {
          billingQuery = billingQuery.andWhere(
            'b.distributorId = :distributorId',
            { distributorId: userDistributorId },
          );
        }

        const billings = await billingQuery.getMany();

        // Get GRN info
        const grnTransaction = await this.transactionRepo
          .createQueryBuilder('t')
          .where('t.itemId = :itemId', { itemId: item.id })
          .andWhere('t.transactionType = :type', { type: 'GRN_RECEIPT' })
          .andWhere('t.referenceType = :refType', { refType: 'GRN' })
          .orderBy('t.createdAt', 'DESC')
          .getOne();

        let grnInfo = null;
        if (grnTransaction?.referenceId) {
          const grn = await this.grnRepo.findOne({
            where: { id: grnTransaction.referenceId },
            relations: ['createdByUser'],
          });
          if (grn) {
            grnInfo = {
              grnNo: grn.grnNo,
              createdAt: grn.createdAt,
              approvedAt: grn.approvedAt || null,
              approvedByUser: grn.approvedBy
                ? grn.createdByUser?.firstName
                : null,
              status: grn.status,
            };
          }
        }

        // Calculate sold quantity from billing items
        let soldQuantity = 0;
        billings.forEach((b: any) => {
          const itemsInBilling =
            b.billingItems?.filter((it: any) => it.itemId === item.id) || [];
          soldQuantity += itemsInBilling.reduce(
            (s: number, it: any) => s + (parseFloat(it.quantity) || 0),
            0,
          );
        });

        // Get batch details with quantities
        const batchDetails = await Promise.all(
          lots.map(async (lot) => {
            const lotQtyResult = await this.transactionRepo
              .createQueryBuilder('t')
              .select(
                `SUM(CASE 
                WHEN t.movementType = 'IN' THEN t.quantity
                WHEN t.movementType = 'OUT' THEN -t.quantity
                WHEN t.movementType = 'RESERVE' THEN -t.quantity
                WHEN t.movementType = 'RELEASE' THEN t.quantity
                ELSE 0 
              END)`,
                'quantity',
              )
              .where('t.lotId = :lotId', { lotId: lot.id })
              .andWhere('t.status = :status', { status: 'COMPLETED' })
              .getRawOne();

            const lotQuantity = Number(lotQtyResult?.quantity) || 0;

            const batchSold = billings.some((b) =>
              b.billingItems?.some(
                (bi: any) => bi.batchNumber === lot.lotNumber,
              ),
            );

            return {
              batchNumber: lot.lotNumber,
              quantity: lotQuantity,
              expiryDate: lot.expiryDate,
              status: batchSold ? 'SOLD' : 'PENDING',
            };
          }),
        );

        return {
          itemId: item.id,
          itemName: item.name,
          totalQuantity: totalQuantity,
          batches: batchDetails.filter((b) => b.quantity > 0),
          status: billings.length > 0 ? 'SOLD' : 'PENDING',
          soldQuantity: soldQuantity,
          pendingQuantity: totalQuantity,
          grnInfo,
          billings: billings.map((b) => {
            const itemsInBilling =
              b.billingItems?.filter((it: any) => it.itemId === item.id) || [];
            const quantityInBilling = itemsInBilling.reduce(
              (sum: number, it: any) => sum + (parseFloat(it.quantity) || 0),
              0,
            );

            return {
              billNo: b.billNo,
              customerId: b.customerId,
              customerName: b.customer
                ? `${b.customer.firstname} ${b.customer.lastname}`
                : 'Unknown',
              customerCity: b.customer?.city || 'N/A',
              quantitySold: quantityInBilling,
              distributorId: b.distributorId,
              distributorName: b.distributor
                ? `${b.distributor.firstName} ${b.distributor.lastName || ''}`
                : `Distributor ${b.distributorId}`,
              amount: b.finalAmount,
              date: b.billDate,
              status: b.status,
            };
          }),
        };
      }),
    );

    return trace;
  }
}
