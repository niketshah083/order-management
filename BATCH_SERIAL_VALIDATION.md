# Batch/Serial Number Validation - IMPLEMENTED ✅

## Requirement
Add validation to ensure that when items have batch tracking or serial tracking enabled, users MUST provide batch/serial numbers when creating sales invoices. Inventory should be maintained accordingly.

---

## Implementation

### 1. Backend Validation ✅

**File**: `order-management/src/billing/billing.service.ts`

#### Added Mandatory Field Validation

**Before:**
```typescript
// Only validated if batch/serial was provided
if (item.batchNumber) {
  // validate batch...
}
```

**After:**
```typescript
// Get item tracking flags from database
const inventoryRecords = await queryRunner.manager.query(
  `SELECT di.id, di.quantity, di.itemId, im.name as itemName,
          im.hasBatchTracking, im.hasSerialTracking
   FROM distributor_inventory di
   INNER JOIN item_master im ON di.itemId = im.id
   WHERE di.distributorId = ? AND di.itemId = ?`,
  [createBillingDto.distributorId, item.itemId],
);

const inventory = inventoryRecords[0];

// VALIDATION: Check if batch number is mandatory
if (inventory.hasBatchTracking && !item.batchNumber) {
  throw new BadRequestException(
    `Batch number is required for item "${item.itemName}" as it has batch tracking enabled`,
  );
}

// VALIDATION: Check if serial number is mandatory
if (inventory.hasSerialTracking && !item.serialNumber) {
  throw new BadRequestException(
    `Serial number is required for item "${item.itemName}" as it has serial tracking enabled`,
  );
}
```

#### Validation Flow

1. **Fetch Item Tracking Flags**: Query includes `hasBatchTracking` and `hasSerialTracking` from `item_master`
2. **Check Batch Tracking**: If item has `hasBatchTracking = true`, batch number is MANDATORY
3. **Check Serial Tracking**: If item has `hasSerialTracking = true`, serial number is MANDATORY
4. **Throw Error**: Clear error message if validation fails
5. **Continue**: Only proceeds if all validations pass

---

### 2. Frontend Validation ✅

**File**: `order-management-frontend/src/app/components/billing/billing-master.component.ts`

#### Added Pre-Submit Validation

**Added in `addItemToBilling()` method:**

```typescript
const item = formValue.selectedItem as ApiItem;

// VALIDATION: Check if batch number is mandatory
if (item.hasBatchTracking && !formValue.batchNumber) {
  this.errorMessage.set(
    `Batch number is required for "${item.name}" as it has batch tracking enabled`
  );
  setTimeout(() => this.errorMessage.set(''), 5000);
  return;
}

// VALIDATION: Check if serial number is mandatory
if (item.hasSerialTracking && !formValue.serialNumber) {
  this.errorMessage.set(
    `Serial number is required for "${item.name}" as it has serial tracking enabled`
  );
  setTimeout(() => this.errorMessage.set(''), 5000);
  return;
}
```

#### User Experience

- ✅ Validation happens BEFORE adding item to billing
- ✅ Clear error message displayed for 5 seconds
- ✅ User cannot proceed without providing required fields
- ✅ Prevents unnecessary API calls

---

### 3. Inventory Management ✅

**Already Implemented Correctly**

The inventory deduction logic was already working correctly:

```typescript
// 1. Decrement main inventory quantity
await this.inventoryService.adjustQuantity(
  inventoryId,
  billing.distributorId,
  -item.quantity,
);

// 2. If batch tracked, decrement batch quantity
if (item.batchNumber) {
  await queryRunner.manager.query(
    `UPDATE batch_details 
     SET quantity = quantity - ? 
     WHERE inventoryId = ? AND batchNumber = ?`,
    [item.quantity, inventoryId, item.batchNumber],
  );

  // Create billing batch detail record for traceability
  const batchDetail = this.billingBatchDetailRepository.create({
    billingId: savedBilling.id,
    itemId: parseInt(item.itemId as any),
    batchNumber: item.batchNumber,
    serialNumber: item.serialNumber || null,
    expiryDate: item.expiryDate || null,
    quantity: item.quantity,
    rate: item.rate,
  });
  await queryRunner.manager.save(batchDetail);
}

// 3. If serial tracked, mark serial as sold (delete from serial_details)
if (item.serialNumber) {
  await queryRunner.manager.query(
    `DELETE FROM serial_details 
     WHERE inventoryId = ? AND serialNumber = ? 
     LIMIT 1`,
    [inventoryId, item.serialNumber],
  );
}
```

#### Inventory Flow

1. **Main Inventory**: Always decremented by quantity sold
2. **Batch Quantity**: Decremented if item has batch tracking
3. **Serial Number**: Deleted from `serial_details` (marks as sold)
4. **Traceability**: Creates `billing_batch_detail` record for audit trail

---

## Validation Rules

### Batch Tracking
- **When**: Item has `hasBatchTracking = true`
- **Required**: Batch number MUST be provided
- **Error**: "Batch number is required for item [name] as it has batch tracking enabled"

### Serial Tracking
- **When**: Item has `hasSerialTracking = true`
- **Required**: Serial number MUST be provided
- **Error**: "Serial number is required for item [name] as it has serial tracking enabled"

### Both Tracking
- **When**: Item has both `hasBatchTracking = true` AND `hasSerialTracking = true`
- **Required**: BOTH batch number AND serial number MUST be provided
- **Errors**: Shows appropriate error for missing field

---

## Testing Scenarios

### Test 1: Item with Batch Tracking Only
1. Create item with `hasBatchTracking = true`
2. Add to GRN with batch number
3. Try to create billing WITHOUT batch number
4. ✅ Should show error: "Batch number is required..."
5. Add batch number
6. ✅ Should allow billing creation
7. ✅ Verify batch quantity decremented

### Test 2: Item with Serial Tracking Only
1. Create item with `hasSerialTracking = true`
2. Add to GRN with serial numbers
3. Try to create billing WITHOUT serial number
4. ✅ Should show error: "Serial number is required..."
5. Add serial number
6. ✅ Should allow billing creation
7. ✅ Verify serial deleted from inventory

### Test 3: Item with Both Tracking
1. Create item with both flags = true
2. Add to GRN with batch AND serial
3. Try to create billing with only batch
4. ✅ Should show error: "Serial number is required..."
5. Try with only serial
6. ✅ Should show error: "Batch number is required..."
7. Add both batch AND serial
8. ✅ Should allow billing creation
9. ✅ Verify both batch quantity decremented AND serial deleted

### Test 4: Item without Tracking
1. Create item with both flags = false
2. Add to GRN without batch/serial
3. Create billing without batch/serial
4. ✅ Should work normally
5. ✅ Only main inventory decremented

---

## Database Tables Affected

### 1. `distributor_inventory`
- **Field**: `quantity`
- **Action**: Decremented by sold quantity
- **Always**: Yes, for all items

### 2. `batch_details`
- **Field**: `quantity`
- **Action**: Decremented by sold quantity
- **When**: Item has batch tracking

### 3. `serial_details`
- **Action**: Record deleted
- **When**: Item has serial tracking
- **Note**: Deletion marks serial as "sold"

### 4. `billing_batch_details`
- **Action**: New record created
- **When**: Item has batch tracking
- **Purpose**: Traceability and audit trail
- **Fields**: billingId, itemId, batchNumber, serialNumber, expiryDate, quantity, rate

---

## Error Messages

### Frontend Errors (User-Friendly)
```
❌ Batch number is required for "Apple" as it has batch tracking enabled
❌ Serial number is required for "iPhone" as it has serial tracking enabled
```

### Backend Errors (API Response)
```json
{
  "statusCode": 400,
  "message": "Batch number is required for item \"Apple\" as it has batch tracking enabled",
  "error": "Bad Request"
}
```

---

## Files Modified

### Backend ✅
- `order-management/src/billing/billing.service.ts`
  - Added `hasBatchTracking` and `hasSerialTracking` to inventory query
  - Added mandatory batch number validation
  - Added mandatory serial number validation
  - Inventory deduction already working correctly

### Frontend ✅
- `order-management-frontend/src/app/components/billing/billing-master.component.ts`
  - Added batch number validation in `addItemToBilling()`
  - Added serial number validation in `addItemToBilling()`
  - Shows error message for 5 seconds

---

## Benefits

1. **Data Integrity**: Ensures batch/serial numbers are always captured when required
2. **Inventory Accuracy**: Proper tracking of batch quantities and serial numbers
3. **Traceability**: Complete audit trail through `billing_batch_details`
4. **User Experience**: Clear error messages guide users to provide required information
5. **Compliance**: Meets regulatory requirements for batch/serial tracking
6. **Stock Management**: Accurate inventory levels maintained across all tracking types

---

## Status
✅ **COMPLETED** - Batch/Serial validation implemented in both frontend and backend with proper inventory management
