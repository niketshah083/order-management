# 🚀 Deployment Guide - Critical Fixes

**Date:** December 4, 2025  
**Version:** 1.0

---

## 📋 Pre-Deployment Checklist

- [ ] Backup database
- [ ] Review all changes
- [ ] Test in development environment
- [ ] Notify users of maintenance window

---

## 🔧 Step-by-Step Deployment

### Step 1: Backup Database

```bash
# MySQL/MariaDB
mysqldump -u root -p order_management > backup_$(date +%Y%m%d_%H%M%S).sql

# Or use your database management tool
```

### Step 2: Pull Latest Code

```bash
cd order-management
git pull origin main  # or your branch name

cd ../order-management-frontend
git pull origin main
```

### Step 3: Install Dependencies (if needed)

```bash
# Backend
cd order-management
npm install

# Frontend
cd ../order-management-frontend
npm install
```

### Step 4: Run Database Migration

```bash
cd order-management

# Check pending migrations
npm run migration:show

# Run migrations
npm run migration:run

# Verify migration success
npm run migration:show
```

**Expected Output:**
```
✓ AddPOApprovalFields1733500001000 - EXECUTED
```

### Step 5: Build Backend

```bash
cd order-management
npm run build
```

### Step 6: Build Frontend

```bash
cd order-management-frontend
npm run build
```

### Step 7: Restart Services

#### Option A: PM2 (Recommended)
```bash
# Backend
pm2 restart order-management-backend

# Frontend (if using PM2 for frontend)
pm2 restart order-management-frontend
```

#### Option B: Manual Restart
```bash
# Stop existing processes
pkill -f "node.*order-management"

# Start backend
cd order-management
npm run start:prod &

# Start frontend (if serving with Node)
cd order-management-frontend
npm run start &
```

#### Option C: Docker
```bash
docker-compose down
docker-compose up -d --build
```

### Step 8: Verify Deployment

#### Backend Health Check:
```bash
curl http://localhost:3000/health
# Expected: {"status":"ok"}
```

#### Database Verification:
```bash
# Connect to database
mysql -u root -p order_management

# Check new columns exist
DESCRIBE purchase_order_master;
# Should show: rejectedBy, rejectedAt columns

# Check existing data
SELECT id, poNo, approvalStatus, approvedBy, rejectedBy 
FROM purchase_order_master 
LIMIT 5;
# All records should have approvalStatus = 'PENDING'
```

#### Frontend Verification:
```bash
# Check if frontend is accessible
curl http://localhost:4200
# Should return HTML
```

---

## 🧪 Post-Deployment Testing

### Test 1: PO Approval Workflow

1. **Login as Distributor:**
   - Navigate to `/purchase-orders/create`
   - Create a new PO with 2-3 items
   - Submit PO
   - Note the PO number

2. **Login as Admin:**
   - Navigate to `/purchase-orders`
   - Find the PO created above
   - Verify it shows "⏳ Pending" badge
   - Click "Approve" button
   - Verify it shows "✓ Approved" badge
   - Click "Mark as Delivered"
   - Verify status changes to "DELIVERED"

3. **Test Rejection:**
   - Create another PO as distributor
   - Login as admin
   - Click "Reject" button
   - Enter reason: "Items not available"
   - Verify it shows "✗ Rejected" badge
   - Try to mark as delivered → Should show error

### Test 2: Stock Validation

1. **Setup Test Data:**
   ```sql
   -- Check current inventory
   SELECT di.id, di.itemId, di.quantity, im.name
   FROM distributor_inventory di
   JOIN item_master im ON di.itemId = im.id
   WHERE di.distributorId = 1
   LIMIT 5;
   ```

2. **Test Insufficient Stock:**
   - Login as distributor
   - Navigate to `/billing`
   - Select a customer
   - Add an item with quantity > available stock
   - Try to save → Should show error: "Insufficient stock for [item]. Available: X, Required: Y"

3. **Test Expired Batch:**
   ```sql
   -- Create expired batch for testing
   INSERT INTO batch_details (inventoryId, batchNumber, quantity, expiryDate)
   VALUES (1, 'TEST-EXPIRED', 10, '2023-01-01');
   ```
   - Try to add this batch in billing
   - Should show error: "Batch TEST-EXPIRED has expired on..."

4. **Test Valid Billing:**
   - Add item with valid batch and sufficient quantity
   - Save billing
   - Verify inventory decremented
   - Verify batch quantity decremented
   - Check `billing_batch_details` table for record

---

## 🔍 Monitoring & Logs

### Check Backend Logs:
```bash
# PM2 logs
pm2 logs order-management-backend

# Or direct log file
tail -f order-management/logs/application.log
```

### Check for Errors:
```bash
# Search for errors in last 100 lines
pm2 logs order-management-backend --lines 100 | grep -i error

# Check database errors
grep -i "database" order-management/logs/application.log | tail -20
```

### Monitor Database:
```sql
-- Check recent PO approvals
SELECT id, poNo, approvalStatus, approvedBy, approvedAt, rejectedBy, rejectedAt
FROM purchase_order_master
WHERE updatedAt > DATE_SUB(NOW(), INTERVAL 1 HOUR)
ORDER BY updatedAt DESC;

-- Check recent billings
SELECT id, billNo, distributorId, finalAmount, createdAt
FROM billings
WHERE createdAt > DATE_SUB(NOW(), INTERVAL 1 HOUR)
ORDER BY createdAt DESC;

-- Check inventory changes
SELECT di.id, im.name, di.quantity, di.updatedAt
FROM distributor_inventory di
JOIN item_master im ON di.itemId = im.id
WHERE di.updatedAt > DATE_SUB(NOW(), INTERVAL 1 HOUR)
ORDER BY di.updatedAt DESC;
```

---

## 🚨 Rollback Procedure (If Needed)

### Step 1: Stop Services
```bash
pm2 stop order-management-backend
pm2 stop order-management-frontend
```

### Step 2: Restore Database
```bash
# Restore from backup
mysql -u root -p order_management < backup_YYYYMMDD_HHMMSS.sql
```

### Step 3: Revert Code
```bash
cd order-management
git checkout <previous-commit-hash>

cd ../order-management-frontend
git checkout <previous-commit-hash>
```

### Step 4: Rebuild & Restart
```bash
cd order-management
npm run build
pm2 restart order-management-backend

cd ../order-management-frontend
npm run build
pm2 restart order-management-frontend
```

---

## 📊 Success Criteria

Deployment is successful if:

- [x] Migration runs without errors
- [x] Backend starts without errors
- [x] Frontend loads correctly
- [x] PO list shows approval status badges
- [x] Admin can approve/reject POs
- [x] Cannot mark PO as delivered without approval
- [x] Billing validates stock availability
- [x] Cannot sell expired batches
- [x] Inventory decrements correctly
- [x] No errors in logs
- [x] All existing functionality still works

---

## 🆘 Troubleshooting

### Issue: Migration Fails

**Error:** `Column 'rejectedBy' already exists`

**Solution:**
```bash
# Check if columns already exist
mysql -u root -p order_management -e "DESCRIBE purchase_order_master;"

# If columns exist, skip migration
# Migration is idempotent and checks for existing columns
```

### Issue: Frontend Shows 404 for PO List

**Solution:**
```bash
# Clear browser cache
# Hard refresh: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)

# Or rebuild frontend
cd order-management-frontend
rm -rf dist
npm run build
```

### Issue: "Cannot approve PO" Error

**Check:**
1. User is logged in as admin/manager
2. PO status is PENDING
3. Backend logs for detailed error

```bash
pm2 logs order-management-backend | grep -i "approve"
```

### Issue: Stock Validation Not Working

**Check:**
1. Billing service has latest code
2. Database has inventory records
3. Backend logs for validation errors

```sql
-- Check inventory
SELECT * FROM distributor_inventory WHERE distributorId = 1;

-- Check batch details
SELECT * FROM batch_details WHERE inventoryId IN (
  SELECT id FROM distributor_inventory WHERE distributorId = 1
);
```

---

## 📞 Support Contacts

- **Backend Issues:** Check `order-management/logs/`
- **Frontend Issues:** Check browser console (F12)
- **Database Issues:** Check MySQL error log

---

## 📝 Post-Deployment Tasks

- [ ] Monitor logs for 24 hours
- [ ] Collect user feedback
- [ ] Document any issues encountered
- [ ] Update user documentation
- [ ] Schedule training session for admins
- [ ] Plan Phase 2 (Batch Traceability Dashboard)

---

**Deployment Status:** ⏳ READY TO DEPLOY  
**Estimated Downtime:** 5-10 minutes  
**Risk Level:** LOW (backward compatible changes)
