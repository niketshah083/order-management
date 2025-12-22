# GRN Batch & Serial Validation - UPDATED ✅

## Overview
Updated GRN validation to properly handle `batchDetails` and `serialDetails` as separate arrays with comprehensive quantity validation.

---

## Data Structure

### BatchEntryDto
```typescript
export class BatchEntryDto {
  batchNumber: string;      // Required
  quantity: number;         // Required, must be > 0
  expiryDate?: string;      // Optional
}
```

### SerialEntryDto
```typescript
export class SerialEntryDto {
  serialNumber: string;     // Required
  quantity?: number;        // Optional, defaults to 1
  expiryDate?: string;      // Optional
}
```

### GrnItemDto
```typescript
export class GrnItemDto {
  poItemId: number;
  itemId: number;
  receivedQuantity: number;
  originalQuantity: number;
  unitPrice: number;
  
  batchDetails?: BatchEntryDto[];    // For batch tracking
  serialDetails?: SerialEntryDto[];  // For serial tracking
  
  // Legacy support
  batchNumber?: string;
  serialNumber?: string;
  expiryDate?: string;
}
```

---

## Validation Rules

### 1. Batch Tracking Validation ✅

#### A. Batch Details Required
```typescript
if (itemMaster.hasBatchTracking && !item.batchNumber && (!item.batchDetails || item.batchDetails.length === 0)) {
  throw new BadRequestException(
    `Batch number is required for item "${itemMaster.name}" as it has batch tracking enabled`
  );
}
```

#### B. Total Batch Quantity Must Match Received Quantity
```typescript
const totalBatchQty = item.batchDetails.reduce((sum, batch) => sum + (batch.quantity || 0), 0);

if (totalBatchQty !== item.receivedQuantity) {
  throw new BadRequestException(
    `Total batch quantity (${totalBatchQty}) must equal received quantity (${item.receivedQuantity})`
  );
}
```

#### C. Each Batch Must Be Valid
```typescript
for (const batch of item.batchDetails) {
  // Batch number required
  if (!batch.batchNumber || !batch.batchNumber.trim()) {
    throw new BadRequestException(
      `Batch number is required for all batches`
    );
  }

  // Quantity must be > 0
  if (!batch.quantity || batch.quantity <= 0) {
    throw new BadRequestException(
      `Batch quantity must be greater than 0 for batch "${batch.batchNumber}"`
    );
  }
}
```

---

### 2. Serial Tracking Validation ✅

#### A. Serial Details Required
```typescript
if (itemMaster.hasSerialTracking && !item.serialNumber && (!item.serialDetails || item.serialDetails.length === 0)) {
  throw new BadRequestException(
    `Serial details are required for item "${itemMaster.name}" as it has serial tracking enabled`
  );
}
```

#### B. Total Serial Quantity Must Match Received Quantity
```typescript
// Each serial entry defaults to quantity 1 if not specified
const totalSerialQty = item.serialDetails.reduce((sum, serial) => sum + (serial.quantity || 1), 0);

if (totalSerialQty !== item.receivedQuantity) {
  throw new BadRequestException(
    `Total serial quantity (${totalSerialQty}) must equal received quantity (${item.receivedQuantity})`
  );
}
```

#### C. Each Serial Must Be Valid
```typescript
for (const serial of item.serialDetails) {
  // Serial number required
  if (!serial.serialNumber || !serial.serialNumber.trim()) {
    throw new BadRequestException(
      `Serial number is required for all serial entries`
    );
  }

  // Quantity must be > 0 if provided
  if (serial.quantity !== undefined && serial.quantity <= 0) {
    throw new BadRequestException(
      `Serial quantity must be greater than 0 for serial "${serial.serialNumber}"`
    );
  }
}
```

#### D. Serial Numbers Must Be Unique
```typescript
const serialNumbers = item.serialDetails.map(s => s.serialNumber);
const uniqueSerials = new Set(serialNumbers);

if (uniqueSerials.size !== serialNumbers.length) {
  throw new BadRequestException(
    `Duplicate serial numbers found. Each serial number must be unique.`
  );
}
```

---

## Example Requests

### Example 1: Item with Batch Tracking Only

```json
{
  "purchaseOrderId": 1,
  "items": [
    {
      "poItemId": 1,
      "itemId": 10,
      "receivedQuantity": 100,
      "originalQuantity": 100,
      "unitPrice": 10.00,
      "batchDetails": [
        {
          "batchNumber": "BATCH001",
          "quantity": 60,
          "expiryDate": "2025-12-31"
        },
        {
          "batchNumber": "BATCH002",
          "quantity": 40,
          "expiryDate": "2025-11-30"
        }
      ]
    }
  ],
  "remarks": "All items received"
}
```

**Validation:**
- ✅ Total batch quantity: 60 + 40 = 100 (matches receivedQuantity)
- ✅ Each batch has valid batch number
- ✅ Each batch has quantity > 0

---

### Example 2: Item with Serial Tracking Only

```json
{
  "purchaseOrderId": 2,
  "items": [
    {
      "poItemId": 2,
      "itemId": 20,
      "receivedQuantity": 3,
      "originalQuantity": 3,
      "unitPrice": 500.00,
      "serialDetails": [
        {
          "serialNumber": "SN001",
          "quantity": 1
        },
        {
          "serialNumber": "SN002",
          "quantity": 1
        },
        {
          "serialNumber": "SN003",
          "quantity": 1
        }
      ]
    }
  ]
}
```

**Validation:**
- ✅ Total serial quantity: 1 + 1 + 1 = 3 (matches receivedQuantity)
- ✅ Each serial has valid serial number
- ✅ All serial numbers are unique
- ✅ Each serial quantity > 0

---

### Example 3: Item with Both Batch and Serial Tracking

```json
{
  "purchaseOrderId": 3,
  "items": [
    {
      "poItemId": 3,
      "itemId": 30,
      "receivedQuantity": 2,
      "originalQuantity": 2,
      "unitPrice": 1000.00,
      "batchDetails": [
        {
          "batchNumber": "BATCH001",
          "quantity": 2,
          "expiryDate": "2025-12-31"
        }
      ],
      "serialDetails": [
        {
          "serialNumber": "SN001",
          "quantity": 1
        },
        {
          "serialNumber": "SN002",
          "quantity": 1
        }
      ]
    }
  ]
}
```

**Validation:**
- ✅ Batch total: 2 (matches receivedQuantity)
- ✅ Serial total: 1 + 1 = 2 (matches receivedQuantity)
- ✅ All batch numbers valid
- ✅ All serial numbers valid and unique

---

## Error Messages

### Batch Validation Errors

```
❌ Batch number is required for item "Apple" as it has batch tracking enabled
❌ Total batch quantity (90) must equal received quantity (100) for item "Apple"
❌ Batch number is required for all batches of item "Apple"
❌ Batch quantity must be greater than 0 for batch "BATCH001" of item "Apple"
```

### Serial Validation Errors

```
❌ Serial details are required for item "iPhone" as it has serial tracking enabled
❌ Total serial quantity (2) must equal received quantity (3) for item "iPhone"
❌ Serial number is required for all serial entries of item "iPhone"
❌ Serial quantity must be greater than 0 for serial "SN001" of item "iPhone"
❌ Duplicate serial numbers found for item "iPhone". Each serial number must be unique.
```

---

## Validation Flow Diagram

```
┌─────────────────────────────────────────┐
│  GRN Request Received                   │
│  - Item: Apple                          │
│  - Received Qty: 100                    │
│  - Has Batch Tracking: true             │
│  - Has Serial Tracking: false           │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  1. Check Batch Tracking Required       │
│     hasBatchTracking: true              │
│     batchDetails provided: ✅           │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  2. Validate Batch Quantities           │
│     BATCH001: 60                        │
│     BATCH002: 40                        │
│     Total: 100                          │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  3. Compare with Received Quantity      │
│     100 === 100 ✅                      │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  4. Validate Each Batch                 │
│     BATCH001: ✅ Valid                  │
│     BATCH002: ✅ Valid                  │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  5. Check Serial Tracking               │
│     hasSerialTracking: false            │
│     ✅ Skip serial validation           │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  ✅ All Validations Passed              │
│  → Create GRN                           │
└─────────────────────────────────────────┘
```

---

## Testing Scenarios

### Test 1: Valid Batch Details
**Input:**
```json
{
  "receivedQuantity": 100,
  "batchDetails": [
    { "batchNumber": "B001", "quantity": 60 },
    { "batchNumber": "B002", "quantity": 40 }
  ]
}
```
**Expected:** ✅ Pass (60 + 40 = 100)

---

### Test 2: Invalid Batch Quantity Total
**Input:**
```json
{
  "receivedQuantity": 100,
  "batchDetails": [
    { "batchNumber": "B001", "quantity": 60 },
    { "batchNumber": "B002", "quantity": 30 }
  ]
}
```
**Expected:** ❌ Error: "Total batch quantity (90) must equal received quantity (100)"

---

### Test 3: Valid Serial Details
**Input:**
```json
{
  "receivedQuantity": 3,
  "serialDetails": [
    { "serialNumber": "SN001", "quantity": 1 },
    { "serialNumber": "SN002", "quantity": 1 },
    { "serialNumber": "SN003", "quantity": 1 }
  ]
}
```
**Expected:** ✅ Pass (1 + 1 + 1 = 3)

---

### Test 4: Invalid Serial Quantity Total
**Input:**
```json
{
  "receivedQuantity": 3,
  "serialDetails": [
    { "serialNumber": "SN001", "quantity": 1 },
    { "serialNumber": "SN002", "quantity": 1 }
  ]
}
```
**Expected:** ❌ Error: "Total serial quantity (2) must equal received quantity (3)"

---

### Test 5: Duplicate Serial Numbers
**Input:**
```json
{
  "receivedQuantity": 2,
  "serialDetails": [
    { "serialNumber": "SN001", "quantity": 1 },
    { "serialNumber": "SN001", "quantity": 1 }
  ]
}
```
**Expected:** ❌ Error: "Duplicate serial numbers found"

---

### Test 6: Valid Both Batch and Serial
**Input:**
```json
{
  "receivedQuantity": 2,
  "batchDetails": [
    { "batchNumber": "B001", "quantity": 2 }
  ],
  "serialDetails": [
    { "serialNumber": "SN001", "quantity": 1 },
    { "serialNumber": "SN002", "quantity": 1 }
  ]
}
```
**Expected:** ✅ Pass (batch: 2, serial: 2, both match receivedQuantity)

---

## Benefits

1. **Separate Concerns**: Batch and serial data are in separate arrays
2. **Flexible Quantities**: Serial entries can have quantities > 1 if needed
3. **Complete Validation**: Both batch and serial quantities validated
4. **Unique Serials**: Prevents duplicate serial numbers
5. **Clear Errors**: Specific error messages for each validation failure
6. **Data Integrity**: Ensures accurate inventory tracking

---

## Files Modified

### Backend ✅
1. **`order-management/src/orders/dto/create-grn.dto.ts`**
   - Removed `serialNumber` from `BatchEntryDto`
   - Kept separate `SerialEntryDto` for serial tracking
   - `GrnItemDto` has both `batchDetails` and `serialDetails` arrays

2. **`order-management/src/orders/grn.service.ts`**
   - Updated validation to check `serialDetails` array
   - Added total serial quantity validation
   - Added individual serial validation
   - Added unique serial number validation
   - Kept batch validation separate and complete

---

## Status
✅ **COMPLETED** - Batch and serial validation properly separated with comprehensive quantity checks
