# 🚨 CRITICAL: Manager Dashboard Endpoints Missing

## Issue
The Manager Dashboard is **BROKEN** because it calls backend endpoints that don't exist.

## Affected Component
- **File**: `order-management-frontend/src/app/components/manager-dashboard/manager-dashboard.component.ts`
- **Service**: `order-management-frontend/src/app/services/manager.service.ts`

## Missing Backend Endpoints

### 1. ❌ Order Approval
```typescript
// Frontend calls:
PATCH /orders/:id/approve

// Backend status: DOES NOT EXIST
// Orders controller has no approve endpoint
```

**Impact**: Managers cannot approve orders through the dashboard

### 2. ❌ Order Rejection
```typescript
// Frontend calls:
PATCH /orders/:id/reject

// Backend status: DOES NOT EXIST
// Orders controller has no reject endpoint
```

**Impact**: Managers cannot reject orders through the dashboard

### 3. ❌ Order Summary
```typescript
// Frontend calls:
GET /orders/summary?month=2024-12

// Backend status: DOES NOT EXIST
// Orders controller has no summary endpoint
```

**Impact**: Dashboard cannot show order statistics

## Working Endpoint ✅
```typescript
// This one works:
PATCH /payment-requests/:id/status
```

## Quick Fix Options

### Option A: Add Endpoints to Orders Controller (Fastest)

Add these methods to `order-management/src/orders/orders.controller.ts`:

```typescript
@Patch(':id/approve')
@ApiOperation({ summary: 'Approve Order' })
async approveOrder(
  @Param('id') id: number,
  @Req() req: ExtendedRequest
) {
  // Check if user is manager or admin
  if (req.userDetails.role !== 'manager' && req.userDetails.role !== 'super_admin') {
    throw new ForbiddenException('Only managers and admins can approve orders');
  }
  
  const data = await this.svc.approveOrder(+id, req.userDetails.userId);
  return { data, message: 'Order approved successfully' };
}

@Patch(':id/reject')
@ApiOperation({ summary: 'Reject Order' })
async rejectOrder(
  @Param('id') id: number,
  @Body() body: { reason: string },
  @Req() req: ExtendedRequest
) {
  // Check if user is manager or admin
  if (req.userDetails.role !== 'manager' && req.userDetails.role !== 'super_admin') {
    throw new ForbiddenException('Only managers and admins can reject orders');
  }
  
  if (!body.reason?.trim()) {
    throw new BadRequestException('Rejection reason is required');
  }
  
  const data = await this.svc.rejectOrder(+id, req.userDetails.userId, body.reason);
  return { data, message: 'Order rejected' };
}

@Get('summary')
@ApiOperation({ summary: 'Get Order Summary' })
async getOrderSummary(
  @Query('month') month: string,
  @Req() req: ExtendedRequest
) {
  const data = await this.svc.getOrderSummary(month, req.userDetails.userId);
  return { data, message: 'Order summary retrieved successfully' };
}
```

Then add these methods to `order-management/src/orders/orders.service.ts`:

```typescript
async approveOrder(orderId: number, userId: number) {
  const order = await this.orderRepo.findOne({ where: { id: orderId } });
  
  if (!order) {
    throw new NotFoundException('Order not found');
  }
  
  if (order.status === 'COMPLETED') {
    throw new BadRequestException('Cannot approve completed order');
  }
  
  order.status = 'APPROVED'; // or whatever status you want
  order.approvedBy = userId;
  order.approvedAt = new Date();
  
  return await this.orderRepo.save(order);
}

async rejectOrder(orderId: number, userId: number, reason: string) {
  const order = await this.orderRepo.findOne({ where: { id: orderId } });
  
  if (!order) {
    throw new NotFoundException('Order not found');
  }
  
  if (order.status === 'COMPLETED') {
    throw new BadRequestException('Cannot reject completed order');
  }
  
  order.status = 'REJECTED';
  order.rejectedBy = userId;
  order.rejectedAt = new Date();
  order.rejectionReason = reason;
  
  return await this.orderRepo.save(order);
}

async getOrderSummary(month: string, userId: number) {
  // Implement summary logic based on your requirements
  const startDate = month ? new Date(month + '-01') : new Date();
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + 1);
  
  const orders = await this.orderRepo.find({
    where: {
      createdAt: Between(startDate, endDate)
    }
  });
  
  return {
    totalOrders: orders.length,
    pendingOrders: orders.filter(o => o.status === 'PENDING').length,
    approvedOrders: orders.filter(o => o.status === 'APPROVED').length,
    completedOrders: orders.filter(o => o.status === 'COMPLETED').length,
    rejectedOrders: orders.filter(o => o.status === 'REJECTED').length,
  };
}
```

**Note**: You may need to add these fields to `OrderEntity`:
- `approvedBy?: number`
- `approvedAt?: Date`
- `rejectedBy?: number`
- `rejectedAt?: Date`
- `rejectionReason?: string`

### Option B: Disable Manager Dashboard Features

If order approval isn't needed, comment out or remove the broken features from the manager dashboard component.

### Option C: Use Purchase Order Workflow

If managers should only approve Purchase Orders (not regular Orders), update the Manager Dashboard to work with Purchase Orders instead.

## Priority
**HIGH** - This affects manager functionality and will cause 404 errors in production.

## Next Steps
1. Decide which option to implement
2. Add missing endpoints or remove broken features
3. Test manager dashboard functionality
4. Update any related documentation
