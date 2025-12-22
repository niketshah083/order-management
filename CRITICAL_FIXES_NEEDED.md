# 🚨 Critical Fixes Needed - Priority Action Items

**Date:** December 4, 2025  
**Status:** URGENT - Production Blockers Identified

---

## ⚠️ CRITICAL ISSUES (Must Fix Before Production)

### **1. PO Approval Workflow Missing** 🔴 **HIGH PRIORITY**

**Problem:** Purchase orders go directly from PENDING → DELIVERED without admin approval.

**Files to Fix:**
- `order-management/src/orders/entities/purchase-order.entity.ts`
- `order-management/src/orders/purchase-orders.service.ts`
- `order-management/src/orders/purchase-orders.controller.ts`
- Create new migration file

**Changes Needed:**

```typescript
// 1. Add to PurchaseOrderEntity:
@Column({ type: 'enum', enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' })
approvalStatus: string;

@Column({ nullable: true })
approvedBy: number;

@Column({ nullable: true })
approvedAt: Date;

@Column({ nullable: true })
rejectedBy: number;

@Column({ nullable: true })
rejectedAt: Date;

@Column({ nullable: true })
rejectionReason: string;

// 2. Add to PurchaseOrdersController:
@Patch(':id/approve')
async approvePurchaseOrder(@Param('id') id: number, @Req() req: ExtendedRequest) {
  // Only admin/manager can approve
  if (req.userDetails.role !== 'super_admin' && req.userDetails.role !== 'manager') {
    throw new ForbiddenException('Only admins can approve purchase orders');
  }
  const result = await this.svc.approvePurchaseOrder(id, req.userDetails.userId);
  return { data: result, message: 'Purchase order approved successfully' };
}

@Patch(':id/reject')
async rejectPurchaseOrder(
  @Param('id') id: number, 
  @Body() body: { reason: string },
  @Req() req: ExtendedRequest
) {
  // Only admin/manager can reject
  if (req.userDetails.role !== 'super_admin' && req.userDetails.role !== 'manager') {
    throw new ForbiddenException('Only admins can reject purchase orders');
  }
  const result = await this.svc.rejectPurchaseOrder(id, req.userDetails.userId, body.reason);
  return { data: result, message: 'Purchase order rejected' };
}

// 3. Add to PurchaseOrdersService:
async approvePurchaseOrder(poId: number, approvedBy: number) {
  const po = await this.poRepo.findOne({ where: { id: poId } });
  if (!po) throw new BadRequestException('Purchase order not found');
  
  if (po.approvalStatus === 'APPROVED') {
    throw new BadRequestException('Purchase order already approved');
  }
  
  po.approvalStatus = 'APPROVED';
  po.approvedBy = approvedBy;
  po.approvedAt = new Date();
  
  await this.poRepo.save(po);
  return po;
}

async rejectPurchaseOrder(poId: number, rejectedBy: number, reason: string) {
  const po = await this.poRepo.findOne({ where: { id: poId } });
  if (!po) throw new BadRequestException('Purchase order not found');
  
  if (po.approvalStatus === 'REJECTED') {
    throw new BadRequestException('Purchase order already rejected');
  }
  
  po.approvalStatus = 'REJECTED';
  po.rejectedBy = rejectedBy;
  po.rejectedAt = new Date();
  po.rejectionReason = reason;
  
  await this.poRepo.save(po);
  return po;
}

// 4. Update markAsDelivered to check approval:
async markAsDelivered(poId: number, batchDetails?: any[]) {
  const po = await this.poRepo.findOne({ where: { id: poId }, relations: ['items', 'items.item'] });
  if (!po) throw new BadRequestException('Purchase order not found');
  
  // CRITICAL: Check approval status
  if (po.approvalStatus !== 'APPROVED') {
    throw new BadRequestException('Purchase order must be approved before marking as delivered');
  }
  
  // ... rest of the logic
}
```

**Frontend Changes:**
- Create `purchase-order-approval.component.ts` for admin
- Add "Approve" and "Reject" buttons in PO list
- Add approval status badge (Pending/Approved/Rejected)
- Add rejection reason modal

---

### **2. Stock Validation Missing in Billing** 🔴 **HIGH PRIORITY**

**Problem:** Can oversell inventory - no stock check when adding items to billing.

**Files to Fix:**
- `order-management/src/billing/billing.service.ts`
- `order-management-frontend/src/app/components/billing/billing-master.component.ts`

**Changes Needed:**

```typescript
// 1. Add to BillingService.create() BEFORE saving:
async create(createBillingDto: CreateBillingDto, userId: number, userIp: string) {
  const queryRunner = this.dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    // CRITICAL: Validate stock availability BEFORE creating billing
    for (const item of createBillingDto.items) {
      // Check if sufficient stock exists
      const inventory = await queryRunner.manager.findOne(DistributorInventoryEntity, {
        where: { distributorId: createBillingDto.distributorId, itemId: item.itemId }
      });
      
      if (!inventory || inventory.quantity < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for ${item.itemName}. Available: ${inventory?.quantity || 0}, Required: ${item.quantity}`
        );
      }
      
      // If batch/serial tracked, validate batch quantity
      if (item.batchNumber) {
        const batchDetail = await queryRunner.manager.findOne(BatchDetailEntity, {
          where: { 
            inventoryId: inventory.id, 
            batchNumber: item.batchNumber 
          }
        });
        
        if (!batchDetail || batchDetail.quantity < item.quantity) {
          throw new BadRequestException(
            `Insufficient quantity in batch ${item.batchNumber}. Available: ${batchDetail?.quantity || 0}, Required: ${item.quantity}`
          );
        }
        
        // Check expiry date
        if (batchDetail.expiryDate) {
          const expiryDate = new Date(batchDetail.expiryDate);
          const today = new Date();
          if (expiryDate < today) {
            throw new BadRequestException(
              `Batch ${item.batchNumber} has expired on ${expiryDate.toDateString()}`
            );
          }
        }
      }
    }
    
    // ... rest of the billing creation logic
  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
  }
}

// 2. Add inventory locking (optional but recommended):
async lockInventoryForBilling(distributorId: number, items: any[]) {
  // Implement pessimistic locking to prevent race conditions
  for (const item of items) {
    await this.dataSource.query(
      `UPDATE distributor_inventory 
       SET reserved_quantity = reserved_quantity + ? 
       WHERE distributorId = ? AND itemId = ? AND (quantity - reserved_quantity) >= ?`,
      [item.quantity, distributorId, item.itemId, item.quantity]
    );
  }
}
```

**Frontend Changes:**
```typescript
// Add to billing-master.component.ts:
async onItemSelect(item: ApiItem, selectedBatch?: any) {
  // Check stock availability
  const stockInfo = this.itemStockStatus().get(item.id);
  
  if (!stockInfo?.inStock || stockInfo.stockQuantity === 0) {
    this.errorMessage.set(`❌ ${item.name} is out of stock`);
    setTimeout(() => this.errorMessage.set(''), 3000);
    return;
  }
  
  // Show warning for low stock
  if (stockInfo.stockQuantity < 10) {
    this.successMessage.set(`⚠️ Low stock alert: Only ${stockInfo.stockQuantity} units available`);
    setTimeout(() => this.successMessage.set(''), 5000);
  }
  
  // ... rest of the logic
}

// Add real-time stock check in batch selector:
selectBatchFromPicker(batch: any) {
  const requestedQty = this.selectedQtyForBatch();
  
  if (batch.quantity < requestedQty) {
    this.errorMessage.set(
      `❌ Insufficient quantity in this batch. Available: ${batch.quantity}, Requested: ${requestedQty}`
    );
    setTimeout(() => this.errorMessage.set(''), 3000);
    return;
  }
  
  // Check expiry
  if (batch.expiryStatus === 'expired') {
    this.errorMessage.set(`❌ This batch has expired. Cannot add to billing.`);
    setTimeout(() => this.errorMessage.set(''), 3000);
    return;
  }
  
  if (batch.expiryStatus === 'expiring_soon') {
    const confirmed = confirm(
      `⚠️ This batch is expiring soon (${batch.expiryDate}). Do you want to continue?`
    );
    if (!confirmed) return;
  }
  
  // ... rest of the logic
}
```

---

### **3. Batch Traceability Dashboard Missing** 🟡 **MEDIUM PRIORITY**

**Problem:** Cannot track where batches are located or view sales history.

**Files to Create:**
- `order-management/src/batch-traceability/batch-traceability.controller.ts`
- `order-management/src/batch-traceability/batch-traceability.service.ts`
- `order-management/src/batch-traceability/batch-traceability.module.ts`
- `order-management-frontend/src/app/components/batch-traceability/batch-traceability-dashboard.component.ts`

**API Endpoints to Create:**

```typescript
// batch-traceability.controller.ts
@Controller('batch-traceability')
export class BatchTraceabilityController {
  
  @Get(':batchNumber')
  async getBatchDetails(@Param('batchNumber') batchNumber: string) {
    // Return complete batch journey:
    // - Where it is (distributor locations)
    // - How much sold
    // - How much pending
    // - Sales history
    // - Movement history
  }
  
  @Get('distributor/:distributorId')
  async getDistributorBatches(@Param('distributorId') distributorId: number) {
    // Return all batches for a distributor
  }
  
  @Get('expiring-soon')
  async getExpiringSoonBatches() {
    // Return batches expiring in next 30 days
  }
  
  @Get('item/:itemId/batches')
  async getItemBatches(@Param('itemId') itemId: number) {
    // Return all batches for an item across all distributors
  }
}
```

**Service Implementation:**

```typescript
// batch-traceability.service.ts
async getBatchDetails(batchNumber: string) {
  // 1. Find all inventory records with this batch
  const inventoryRecords = await this.batchDetailRepo.find({
    where: { batchNumber },
    relations: ['inventory', 'inventory.distributor', 'inventory.item']
  });
  
  // 2. Find all sales with this batch
  const sales = await this.billingBatchDetailRepo.find({
    where: { batchNumber },
    relations: ['billing', 'billing.customer']
  });
  
  // 3. Calculate totals
  const totalQuantity = inventoryRecords.reduce((sum, inv) => sum + inv.quantity, 0);
  const soldQuantity = sales.reduce((sum, sale) => sum + sale.quantity, 0);
  const pendingQuantity = totalQuantity - soldQuantity;
  
  // 4. Build response
  return {
    batchNumber,
    totalQuantity,
    soldQuantity,
    pendingQuantity,
    locations: inventoryRecords.map(inv => ({
      distributorId: inv.inventory.distributorId,
      distributorName: inv.inventory.distributor.businessName,
      quantity: inv.quantity,
      lastUpdated: inv.updatedAt
    })),
    sales: sales.map(sale => ({
      billingId: sale.billingId,
      billNo: sale.billing.billNo,
      customerName: sale.billing.customer.firstname + ' ' + sale.billing.customer.lastname,
      quantity: sale.quantity,
      billDate: sale.billing.billDate
    }))
  };
}
```

---

## 📋 Implementation Checklist

### **Week 1 (Critical):**
- [ ] Add approval fields to PurchaseOrderEntity
- [ ] Create migration for approval fields
- [ ] Implement approve/reject endpoints
- [ ] Update markAsDelivered to check approval
- [ ] Create frontend approval UI
- [ ] Add stock validation in BillingService
- [ ] Add batch quantity validation
- [ ] Add expiry date validation
- [ ] Update frontend to show stock warnings

### **Week 2 (Important):**
- [ ] Create BatchTraceabilityModule
- [ ] Implement batch tracking endpoints
- [ ] Create batch dashboard component
- [ ] Add batch search functionality
- [ ] Add expiry alerts

### **Week 3 (Enhancement):**
- [ ] Implement inventory locking
- [ ] Add low stock alerts
- [ ] Add batch recall feature
- [ ] Complete audit trail

---

## 🎯 Success Criteria

After implementing these fixes:

1. ✅ Admin must approve POs before delivery
2. ✅ Cannot oversell inventory
3. ✅ Cannot sell expired batches
4. ✅ Can track batch location with single click
5. ✅ Can see batch sales history
6. ✅ System prevents race conditions in billing

---

**Priority:** 🔴 **URGENT - Start Immediately**  
**Estimated Effort:** 2-3 weeks  
**Risk if Not Fixed:** Production data corruption, overselling, compliance issues
