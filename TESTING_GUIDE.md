# GRN Batch/Serial Validation - Quick Testing Guide

## 🚀 Quick Start

### 1. Restart Backend
```bash
cd order-management
npm run start:dev
```

### 2. Test Scenarios

#### ✅ Test 1: Batch Tracking Only
**Item Setup:**
- Create/use item with `hasBatchTracking = true`
- Create PO with this item
- Mark PO as DELIVERED

**Test Steps:**
1. Go to GRN creation page
2. You should see "📦 Batch Tracking" indicator
3. Click "+ Add Batch" button
4. Enter:
   - Batch Number: BATCH001
   - Quantity: 50
   - Expiry Date: 2025-12-31
5. Click "+ Add Batch" again
6. Enter:
   - Batch Number: BATCH002
   - Quantity: 50
   - Expiry Date: 2025-11-30
7. Verify total shows: "Total Qty: 100 / 100"
8. Click "Create GRN"

**Expected Result:** ✅ GRN created successfully

**Error Test:**
- Change BATCH002 quantity to 30
- Total will show: "Total Qty: 80 / 100"
- Try to submit
- **Expected:** ❌ Error: "Total batch quantity (80) must equal received quantity (100)"

---

#### ✅ Test 2: Serial Tracking Only
**Item Setup:**
- Create/use item with `hasSerialTracking = true`
- Create PO with this item (quantity: 3)
- Mark PO as DELIVERED

**Test Steps:**
1. Go to GRN creation page
2. You should see "🔢 Serial Tracking" indicator
3. Click "+ Add Serial" button three times
4. Enter:
   - Serial 1: SN001, Qty: 1
   - Serial 2: SN002, Qty: 1
   - Serial 3: SN003, Qty: 1
5. Verify total shows: "Total Qty: 3 / 3"
6. Click "Create GRN"

**Expected Result:** ✅ GRN created successfully

**Error Test - Duplicate Serials:**
- Change Serial 2 to: SN001 (duplicate)
- Try to submit
- **Expected:** ❌ Error: "Duplicate serial numbers found"

**Error Test - Quantity Mismatch:**
- Remove Serial 3
- Total will show: "Total Qty: 2 / 3"
- Try to submit
- **Expected:** ❌ Error: "Total serial quantity (2) must equal received quantity (3)"

---

#### ✅ Test 3: Both Batch and Serial Tracking
**Item Setup:**
- Create/use item with both `hasBatchTracking = true` AND `hasSerialTracking = true`
- Create PO with this item (quantity: 2)
- Mark PO as DELIVERED

**Test Steps:**
1. Go to GRN creation page
2. You should see both "📦 Batch Tracking" and "🔢 Serial Tracking" indicators
3. Add batch details:
   - Batch Number: BATCH001
   - Quantity: 2
   - Expiry Date: 2025-12-31
4. Add serial details:
   - Serial 1: SN001, Qty: 1
   - Serial 2: SN002, Qty: 1
5. Verify both totals show: "Total Qty: 2 / 2"
6. Click "Create GRN"

**Expected Result:** ✅ GRN created successfully with both batch and serial records

---

#### ✅ Test 4: No Tracking
**Item Setup:**
- Create/use item with `hasBatchTracking = false` AND `hasSerialTracking = false`
- Create PO with this item
- Mark PO as DELIVERED

**Test Steps:**
1. Go to GRN creation page
2. You should NOT see batch or serial sections
3. Just enter received quantity
4. Click "Create GRN"

**Expected Result:** ✅ GRN created successfully without batch/serial details

---

## 🔍 Validation Rules Summary

| Rule | Description | Error Message |
|------|-------------|---------------|
| **Mandatory Batch** | If `hasBatchTracking = true`, batch details required | "Batch number is required for item..." |
| **Mandatory Serial** | If `hasSerialTracking = true`, serial details required | "Serial details are required for item..." |
| **Batch Qty Match** | Sum of batch quantities must equal received quantity | "Total batch quantity (X) must equal received quantity (Y)" |
| **Serial Qty Match** | Sum of serial quantities must equal received quantity | "Total serial quantity (X) must equal received quantity (Y)" |
| **Valid Batch** | Each batch must have non-empty batch number and qty > 0 | "Batch number is required..." or "Batch quantity must be greater than 0..." |
| **Valid Serial** | Each serial must have non-empty serial number and qty > 0 | "Serial number is required..." or "Serial quantity must be greater than 0..." |
| **Unique Serials** | All serial numbers must be unique | "Duplicate serial numbers found..." |

---

## 🐛 Common Issues & Solutions

### Issue 1: "Cannot create GRN - PO not delivered"
**Solution:** Mark the PO as "DELIVERED" first from the PO list

### Issue 2: Batch/Serial sections not showing
**Solution:** Check item master - ensure `hasBatchTracking` or `hasSerialTracking` is enabled

### Issue 3: Submit button disabled
**Solution:** Check if total batch/serial quantities match received quantity. Look for red error text.

### Issue 4: Backend validation error after frontend passes
**Solution:** This shouldn't happen, but if it does:
1. Check browser console for the exact error
2. Verify the request payload in Network tab
3. Ensure backend is restarted after code changes

---

## 📊 Database Verification

After creating GRN, verify data in database:

### Check GRN Record
```sql
SELECT * FROM grn WHERE grn_no = 'GRN-xxxxx';
```

### Check GRN Items
```sql
SELECT * FROM grn_item WHERE grn_id = X;
```

### Check Batch Details
```sql
SELECT * FROM grn_batch_detail WHERE grn_item_id = X;
```

### Check Inventory Updates
```sql
SELECT * FROM distributor_inventory WHERE item_id = X;
SELECT * FROM batch_detail WHERE inventory_id = X;
SELECT * FROM serial_detail WHERE inventory_id = X;
```

---

## ✅ Success Criteria

- [ ] Can create GRN with batch tracking items
- [ ] Can create GRN with serial tracking items
- [ ] Can create GRN with both batch and serial tracking
- [ ] Can create GRN with no tracking
- [ ] Frontend shows validation errors in real-time
- [ ] Backend rejects invalid batch quantities
- [ ] Backend rejects invalid serial quantities
- [ ] Backend rejects duplicate serial numbers
- [ ] Inventory updates correctly after GRN approval
- [ ] Batch details saved to database
- [ ] Serial details saved to database

---

## 🎯 Test Coverage

| Scenario | Frontend | Backend | Status |
|----------|----------|---------|--------|
| Batch tracking mandatory | ✅ | ✅ | Ready |
| Serial tracking mandatory | ✅ | ✅ | Ready |
| Batch quantity validation | ✅ | ✅ | Ready |
| Serial quantity validation | ✅ | ✅ | Ready |
| Unique serial validation | ✅ | ✅ | Ready |
| Both tracking types | ✅ | ✅ | Ready |
| No tracking | ✅ | ✅ | Ready |
| Real-time UI feedback | ✅ | N/A | Ready |
| Error messages | ✅ | ✅ | Ready |

**Overall Status: 🟢 READY FOR TESTING**
