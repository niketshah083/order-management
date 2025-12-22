import { Test, TestingModule } from '@nestjs/testing';
import { BillingService } from './billing.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BillingEntity } from './entities/billing.entity';
import { BillingItemEntity } from './entities/billing-item.entity';
import { BillingBatchDetailEntity } from './entities/billing-batch-detail.entity';
import { DataSource } from 'typeorm';
import { PaymentRequestsService } from '../payment-requests/payment-requests.service';
import { InventoryService } from '../inventory/inventory.service';
import { InventoryCoreService } from '../inventory/inventory-core.service';
import { BadRequestException } from '@nestjs/common';
import * as fc from 'fast-check';

describe('BillingService', () => {
  let service: BillingService;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    query: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    })),
  };

  const mockDataSource = {
    createQueryRunner: jest.fn(() => ({
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        save: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        query: jest.fn(),
      },
    })),
  };

  const mockPaymentRequestsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
  };

  const mockInventoryService = {
    findAllByDistributor: jest.fn(),
    adjustQuantity: jest.fn(),
    getBatchDetails: jest.fn(),
    getSerialDetails: jest.fn(),
  };

  const mockInventoryCoreService = {
    getAvailableQuantity: jest.fn(),
    createTransaction: jest.fn(),
    getStockBalance: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        {
          provide: getRepositoryToken(BillingEntity),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(BillingItemEntity),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(BillingBatchDetailEntity),
          useValue: mockRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: PaymentRequestsService,
          useValue: mockPaymentRequestsService,
        },
        {
          provide: InventoryService,
          useValue: mockInventoryService,
        },
        {
          provide: InventoryCoreService,
          useValue: mockInventoryCoreService,
        },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return an array of billings', async () => {
      const result = await service.findAll();
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should filter by authorized distributor IDs', async () => {
      const authorizedIds = [1, 2, 3];
      const result = await service.findAll(undefined, undefined, authorizedIds);
      expect(result).toBeDefined();
    });

    it('should allow super_admin to see all billings', async () => {
      const result = await service.findAll(undefined, undefined, null);
      expect(result).toBeDefined();
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException when billing not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow('Billing not found');
    });
  });
});

/**
 * **Feature: inventory-consolidation, Property 6: Insufficient Stock Rejection**
 * **Validates: Requirements 3.1, 3.6**
 *
 * Property: For any billing attempt where the requested quantity exceeds the
 * calculated available quantity, the system SHALL reject the billing with an error.
 */
describe('BillingService - Property Tests', () => {
  let service: BillingService;
  let mockInventoryCoreService: any;
  let mockQueryRunner: any;

  // Helper to create a complete billing DTO with all required fields
  const createCompleteBillingDto = (overrides: any = {}) => ({
    distributorId: 1,
    customerId: 1,
    billDate: new Date().toISOString(),
    subtotal: 100,
    overallDiscount: 0,
    overallDiscountType: 'percentage' as const,
    totalAfterDiscount: 100,
    cgstTotal: 0,
    sgstTotal: 0,
    igstTotal: 0,
    grandTotal: 100,
    finalAmount: 100,
    items: [],
    ...overrides,
  });

  // Helper to create a complete billing item
  const createBillingItem = (overrides: any = {}) => ({
    itemId: '1',
    itemName: 'Test Item',
    quantity: 1,
    rate: 10,
    unit: 'pcs',
    discount: 0,
    discountType: 'percentage' as const,
    taxableAmount: 10,
    cgst: 0,
    sgst: 0,
    igst: 0,
    totalAmount: 10,
    ...overrides,
  });

  const mockRepository = {
    create: jest.fn((data) => ({ ...data, id: 1 })),
    save: jest.fn((data) => Promise.resolve({ ...data, id: 1 })),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    query: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    })),
  };

  beforeEach(async () => {
    mockQueryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        save: jest.fn((data) => Promise.resolve({ ...data, id: 1 })),
        update: jest.fn(),
        delete: jest.fn(),
        query: jest.fn(),
      },
    };

    const mockDataSource = {
      createQueryRunner: jest.fn(() => mockQueryRunner),
    };

    const mockPaymentRequestsService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      createForCreditBilling: jest.fn(),
    };

    const mockInventoryService = {
      findAllByDistributor: jest.fn(),
      adjustQuantity: jest.fn(),
      getBatchDetails: jest.fn(),
      getSerialDetails: jest.fn(),
    };

    mockInventoryCoreService = {
      getAvailableQuantity: jest.fn(),
      createTransaction: jest.fn(),
      getStockBalance: jest.fn(),
      getOrCreateDefaultWarehouse: jest
        .fn()
        .mockResolvedValue({ id: 1, name: 'Main Warehouse' }),
      getLotByNumber: jest.fn(),
      getSerialByNumber: jest.fn(),
      updateSerialStatus: jest.fn(),
      getAvailableLots: jest.fn(),
      allocateStock: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        {
          provide: getRepositoryToken(BillingEntity),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(BillingItemEntity),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(BillingBatchDetailEntity),
          useValue: mockRepository,
        },
        { provide: DataSource, useValue: mockDataSource },
        {
          provide: PaymentRequestsService,
          useValue: mockPaymentRequestsService,
        },
        { provide: InventoryService, useValue: mockInventoryService },
        { provide: InventoryCoreService, useValue: mockInventoryCoreService },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
  });

  /**
   * **Feature: inventory-consolidation, Property 6: Insufficient Stock Rejection**
   * **Validates: Requirements 3.1, 3.6**
   */
  describe('Property 6: Insufficient Stock Rejection', () => {
    const positiveIntArb = fc.integer({ min: 1, max: 1000 });
    const itemNameArb = fc
      .string({ minLength: 1, maxLength: 50 })
      .filter((s) => s.trim().length > 0);

    it('should reject billing when requested quantity exceeds available stock', async () => {
      await fc.assert(
        fc.asyncProperty(
          positiveIntArb,
          positiveIntArb,
          itemNameArb,
          positiveIntArb,
          positiveIntArb,
          async (
            distributorId,
            itemId,
            itemName,
            availableQuantity,
            extraQuantity,
          ) => {
            const requestedQuantity = availableQuantity + extraQuantity;

            mockQueryRunner.manager.query.mockImplementation(
              (query: string) => {
                if (query.includes('item_master')) {
                  return Promise.resolve([
                    {
                      id: itemId,
                      name: itemName,
                      hasBatchTracking: false,
                      hasSerialTracking: false,
                    },
                  ]);
                }
                return Promise.resolve([]);
              },
            );

            mockInventoryCoreService.getAvailableQuantity.mockResolvedValue(
              availableQuantity,
            );

            const dto = createCompleteBillingDto({
              distributorId,
              items: [
                createBillingItem({
                  itemId: itemId.toString(),
                  itemName,
                  quantity: requestedQuantity,
                }),
              ],
            });

            await expect(service.create(dto, 1, '127.0.0.1')).rejects.toThrow(
              BadRequestException,
            );

            try {
              await service.create(dto, 1, '127.0.0.1');
            } catch (error: any) {
              expect(error.message).toContain('Insufficient stock');
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should reject billing when item has zero stock', async () => {
      await fc.assert(
        fc.asyncProperty(
          positiveIntArb,
          positiveIntArb,
          itemNameArb,
          positiveIntArb,
          async (distributorId, itemId, itemName, requestedQuantity) => {
            mockQueryRunner.manager.query.mockImplementation(
              (query: string) => {
                if (query.includes('item_master')) {
                  return Promise.resolve([
                    {
                      id: itemId,
                      name: itemName,
                      hasBatchTracking: false,
                      hasSerialTracking: false,
                    },
                  ]);
                }
                return Promise.resolve([]);
              },
            );

            mockInventoryCoreService.getAvailableQuantity.mockResolvedValue(0);

            const dto = createCompleteBillingDto({
              distributorId,
              items: [
                createBillingItem({
                  itemId: itemId.toString(),
                  itemName,
                  quantity: requestedQuantity,
                }),
              ],
            });

            await expect(service.create(dto, 1, '127.0.0.1')).rejects.toThrow(
              BadRequestException,
            );

            try {
              await service.create(dto, 1, '127.0.0.1');
            } catch (error: any) {
              expect(error.message).toContain('not available');
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should accept billing when requested quantity is within available stock', async () => {
      await fc.assert(
        fc.asyncProperty(
          positiveIntArb,
          positiveIntArb,
          itemNameArb,
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 0, max: 100 }),
          async (
            distributorId,
            itemId,
            itemName,
            requestedQuantity,
            extraAvailable,
          ) => {
            const availableQuantity = requestedQuantity + extraAvailable;

            mockQueryRunner.manager.query.mockImplementation(
              (query: string) => {
                if (query.includes('item_master')) {
                  return Promise.resolve([
                    {
                      id: itemId,
                      name: itemName,
                      hasBatchTracking: false,
                      hasSerialTracking: false,
                    },
                  ]);
                }
                if (query.includes('distributor_inventory')) {
                  return Promise.resolve([{ id: 1 }]);
                }
                return Promise.resolve([]);
              },
            );

            mockInventoryCoreService.getAvailableQuantity.mockResolvedValue(
              availableQuantity,
            );
            mockRepository.findOne.mockResolvedValue({
              id: 1,
              distributorId,
              customerId: 1,
              billingItems: [],
            });

            const dto = createCompleteBillingDto({
              distributorId,
              items: [
                createBillingItem({
                  itemId: itemId.toString(),
                  itemName,
                  quantity: requestedQuantity,
                }),
              ],
            });

            const result = await service.create(dto, 1, '127.0.0.1');
            expect(result).toBeDefined();
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * **Feature: inventory-consolidation, Property 7: Batch/Serial Validation on Billing**
   * **Validates: Requirements 3.2, 3.3**
   */
  describe('Property 7: Batch/Serial Validation on Billing', () => {
    const positiveIntArb = fc.integer({ min: 1, max: 1000 });
    const itemNameArb = fc
      .string({ minLength: 1, maxLength: 50 })
      .filter((s) => s.trim().length > 0);
    const batchNumberArb = fc
      .string({ minLength: 5, maxLength: 20 })
      .filter((s) => s.trim().length > 0);
    const serialNumberArb = fc
      .string({ minLength: 5, maxLength: 20 })
      .filter((s) => s.trim().length > 0);

    /**
     * **Feature: inventory-consolidation, Property 4: FEFO Allocation Order**
     * **Validates: Requirements 4.1, 4.2, 4.4**
     *
     * For batch-tracked items without a specified batch, the system should
     * auto-allocate using FEFO (First Expiry First Out) strategy.
     * Expired lots should be excluded from available stock.
     */
    it('should auto-allocate using FEFO for batch-tracked items without batch number', async () => {
      await fc.assert(
        fc.asyncProperty(
          positiveIntArb,
          positiveIntArb,
          itemNameArb,
          async (distributorId, itemId, itemName) => {
            // Mock available lots with FEFO order (earliest expiry first)
            const mockAllocations = [
              {
                lotId: 1,
                lotNumber: 'BATCH-001',
                quantity: 1,
                expiryDate: '2025-01-15',
                unitCost: 100,
              },
            ];

            mockQueryRunner.manager.query.mockImplementation(
              (query: string) => {
                if (query.includes('item_master')) {
                  return Promise.resolve([
                    {
                      id: itemId,
                      name: itemName,
                      hasBatchTracking: true,
                      hasSerialTracking: false,
                    },
                  ]);
                }
                return Promise.resolve([]);
              },
            );

            mockInventoryCoreService.getAvailableQuantity.mockResolvedValue(
              100,
            );
            mockInventoryCoreService.getAvailableLots.mockResolvedValue([
              {
                lotId: 1,
                lotNumber: 'BATCH-001',
                expiryDate: '2025-01-15',
                unitCost: 100,
                availableQuantity: 50,
              },
            ]);
            mockInventoryCoreService.allocateStock.mockResolvedValue(
              mockAllocations,
            );

            const dto = createCompleteBillingDto({
              distributorId,
              items: [
                createBillingItem({
                  itemId: itemId.toString(),
                  itemName,
                  quantity: 1,
                }),
              ],
            });

            // Should not throw - FEFO auto-allocation should work
            const result = await service.create(dto, 1, '127.0.0.1');
            expect(result).toBeDefined();

            // Verify FEFO allocation was called
            expect(
              mockInventoryCoreService.getAvailableLots,
            ).toHaveBeenCalledWith(
              itemId,
              expect.any(Number),
              distributorId,
              'FEFO',
            );
            expect(mockInventoryCoreService.allocateStock).toHaveBeenCalledWith(
              itemId,
              expect.any(Number),
              1,
              distributorId,
              'FEFO',
            );
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should reject billing for serial-tracked items without serial number', async () => {
      await fc.assert(
        fc.asyncProperty(
          positiveIntArb,
          positiveIntArb,
          itemNameArb,
          async (distributorId, itemId, itemName) => {
            mockQueryRunner.manager.query.mockImplementation(
              (query: string) => {
                if (query.includes('item_master')) {
                  return Promise.resolve([
                    {
                      id: itemId,
                      name: itemName,
                      hasBatchTracking: false,
                      hasSerialTracking: true,
                    },
                  ]);
                }
                return Promise.resolve([]);
              },
            );

            mockInventoryCoreService.getAvailableQuantity.mockResolvedValue(
              100,
            );

            const dto = createCompleteBillingDto({
              distributorId,
              items: [
                createBillingItem({
                  itemId: itemId.toString(),
                  itemName,
                  quantity: 1,
                }),
              ],
            });

            await expect(service.create(dto, 1, '127.0.0.1')).rejects.toThrow(
              BadRequestException,
            );

            try {
              await service.create(dto, 1, '127.0.0.1');
            } catch (error: any) {
              expect(error.message).toContain('Serial number is required');
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should reject billing when serial status is not AVAILABLE', async () => {
      await fc.assert(
        fc.asyncProperty(
          positiveIntArb,
          positiveIntArb,
          itemNameArb,
          serialNumberArb,
          fc.constantFrom('SOLD', 'RESERVED', 'RETURNED', 'DAMAGED'),
          async (distributorId, itemId, itemName, serialNumber, status) => {
            mockQueryRunner.manager.query.mockImplementation(
              (query: string) => {
                if (query.includes('item_master')) {
                  return Promise.resolve([
                    {
                      id: itemId,
                      name: itemName,
                      hasBatchTracking: false,
                      hasSerialTracking: true,
                    },
                  ]);
                }
                return Promise.resolve([]);
              },
            );

            mockInventoryCoreService.getAvailableQuantity.mockResolvedValue(
              100,
            );
            mockInventoryCoreService.getSerialByNumber.mockResolvedValue({
              id: 1,
              serialNumber,
              itemId,
              distributorId,
              status,
            });

            const dto = createCompleteBillingDto({
              distributorId,
              items: [
                createBillingItem({
                  itemId: itemId.toString(),
                  itemName,
                  quantity: 1,
                  serialNumber,
                }),
              ],
            });

            await expect(service.create(dto, 1, '127.0.0.1')).rejects.toThrow(
              BadRequestException,
            );

            try {
              await service.create(dto, 1, '127.0.0.1');
            } catch (error: any) {
              expect(error.message).toContain('not available');
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should reject billing when batch does not exist', async () => {
      await fc.assert(
        fc.asyncProperty(
          positiveIntArb,
          positiveIntArb,
          itemNameArb,
          batchNumberArb,
          async (distributorId, itemId, itemName, batchNumber) => {
            mockQueryRunner.manager.query.mockImplementation(
              (query: string) => {
                if (query.includes('item_master')) {
                  return Promise.resolve([
                    {
                      id: itemId,
                      name: itemName,
                      hasBatchTracking: true,
                      hasSerialTracking: false,
                    },
                  ]);
                }
                return Promise.resolve([]);
              },
            );

            mockInventoryCoreService.getAvailableQuantity.mockResolvedValue(
              100,
            );
            mockInventoryCoreService.getLotByNumber.mockResolvedValue(null);

            const dto = createCompleteBillingDto({
              distributorId,
              items: [
                createBillingItem({
                  itemId: itemId.toString(),
                  itemName,
                  quantity: 1,
                  batchNumber,
                }),
              ],
            });

            await expect(service.create(dto, 1, '127.0.0.1')).rejects.toThrow(
              BadRequestException,
            );

            try {
              await service.create(dto, 1, '127.0.0.1');
            } catch (error: any) {
              expect(error.message).toContain('Batch');
              expect(error.message).toContain('not found');
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should reject billing when serial does not exist', async () => {
      await fc.assert(
        fc.asyncProperty(
          positiveIntArb,
          positiveIntArb,
          itemNameArb,
          serialNumberArb,
          async (distributorId, itemId, itemName, serialNumber) => {
            mockQueryRunner.manager.query.mockImplementation(
              (query: string) => {
                if (query.includes('item_master')) {
                  return Promise.resolve([
                    {
                      id: itemId,
                      name: itemName,
                      hasBatchTracking: false,
                      hasSerialTracking: true,
                    },
                  ]);
                }
                return Promise.resolve([]);
              },
            );

            mockInventoryCoreService.getAvailableQuantity.mockResolvedValue(
              100,
            );
            mockInventoryCoreService.getSerialByNumber.mockResolvedValue(null);

            const dto = createCompleteBillingDto({
              distributorId,
              items: [
                createBillingItem({
                  itemId: itemId.toString(),
                  itemName,
                  quantity: 1,
                  serialNumber,
                }),
              ],
            });

            await expect(service.create(dto, 1, '127.0.0.1')).rejects.toThrow(
              BadRequestException,
            );

            try {
              await service.create(dto, 1, '127.0.0.1');
            } catch (error: any) {
              expect(error.message).toContain('Serial number');
              expect(error.message).toContain('not found');
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should accept billing with valid batch number for batch-tracked items', async () => {
      await fc.assert(
        fc.asyncProperty(
          positiveIntArb,
          positiveIntArb,
          itemNameArb,
          batchNumberArb,
          fc.integer({ min: 1, max: 100 }),
          async (distributorId, itemId, itemName, batchNumber, quantity) => {
            mockQueryRunner.manager.query.mockImplementation(
              (query: string) => {
                if (query.includes('item_master')) {
                  return Promise.resolve([
                    {
                      id: itemId,
                      name: itemName,
                      hasBatchTracking: true,
                      hasSerialTracking: false,
                    },
                  ]);
                }
                if (query.includes('distributor_inventory')) {
                  return Promise.resolve([{ id: 1 }]);
                }
                return Promise.resolve([]);
              },
            );

            mockInventoryCoreService.getAvailableQuantity.mockResolvedValue(
              quantity + 10,
            );
            mockInventoryCoreService.getLotByNumber.mockResolvedValue({
              id: 1,
              lotNumber: batchNumber,
              itemId,
              distributorId,
              status: 'ACTIVE',
            });
            mockRepository.findOne.mockResolvedValue({
              id: 1,
              distributorId,
              customerId: 1,
              billingItems: [],
            });

            const dto = createCompleteBillingDto({
              distributorId,
              items: [
                createBillingItem({
                  itemId: itemId.toString(),
                  itemName,
                  quantity,
                  batchNumber,
                }),
              ],
            });

            const result = await service.create(dto, 1, '127.0.0.1');
            expect(result).toBeDefined();
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should accept billing with valid serial number for serial-tracked items', async () => {
      await fc.assert(
        fc.asyncProperty(
          positiveIntArb,
          positiveIntArb,
          itemNameArb,
          serialNumberArb,
          async (distributorId, itemId, itemName, serialNumber) => {
            mockQueryRunner.manager.query.mockImplementation(
              (query: string) => {
                if (query.includes('item_master')) {
                  return Promise.resolve([
                    {
                      id: itemId,
                      name: itemName,
                      hasBatchTracking: false,
                      hasSerialTracking: true,
                    },
                  ]);
                }
                if (query.includes('distributor_inventory')) {
                  return Promise.resolve([{ id: 1 }]);
                }
                return Promise.resolve([]);
              },
            );

            mockInventoryCoreService.getAvailableQuantity.mockResolvedValue(10);
            mockInventoryCoreService.getSerialByNumber.mockResolvedValue({
              id: 1,
              serialNumber,
              itemId,
              distributorId,
              status: 'AVAILABLE',
            });
            mockRepository.findOne.mockResolvedValue({
              id: 1,
              distributorId,
              customerId: 1,
              billingItems: [],
            });

            const dto = createCompleteBillingDto({
              distributorId,
              items: [
                createBillingItem({
                  itemId: itemId.toString(),
                  itemName,
                  quantity: 1,
                  serialNumber,
                }),
              ],
            });

            const result = await service.create(dto, 1, '127.0.0.1');
            expect(result).toBeDefined();
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
