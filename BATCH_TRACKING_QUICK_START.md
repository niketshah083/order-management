# Batch Tracking - Quick Start Guide

## ✅ System Status: LIVE & READY

**Server:** http://localhost:4001  
**Module:** `src/batch-tracking/`  
**Status:** Running ✅

## 🚀 Quick Test (3 Steps)

### Step 1: Get Auth Token
```bash
curl -X POST http://localhost:4001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your-email@example.com","password":"your-password"}'
```

Save the JWT token from response.

### Step 2: Test Batch Tracking
```bash
# Replace YOUR_TOKEN with actual JWT token

# Get all batches
curl http://localhost:4001/batch-tracking/all-batches \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get specific batch
curl http://localhost:4001/batch-tracking/batch/BATCH001 \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get distributor batches
curl http://localhost:4001/batch-tracking/distributor/1 \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get expiring batches
curl "http://localhost:4001/batch-tracking/expiring?days=30" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Step 3: Integrate with Frontend
```typescript
// In your Angular service
import { HttpClient } from '@angular/common/http';

export class BatchTrackingService {
  constructor(private http: HttpClient) {}

  getBatchDetails(batchNumber: string) {
    return this.http.get(`/api/batch-tracking/batch/${batchNumber}`);
  }

  getDistributorBatches(distributorId: number) {
    return this.http.get(`/api/batch-tracking/distributor/${distributorId}`);
  }

  getAllBatches() {
    return this.http.get('/api/batch-tracking/all-batches');
  }

  getExpiringBatches(days: number = 30) {
    return this.http.get(`/api/batch-tracking/expiring?days=${days}`);
  }
}
```

## 📋 API Endpoints

| Endpoint | Method | Description | Auth |
|----------|--------|-------------|------|
| `/batch-tracking/batch/:batchNumber` | GET | Get batch details | Required |
| `/batch-tracking/distributor/:id` | GET | Get distributor batches | Required |
| `/batch-tracking/all-batches` | GET | Get all batches (admin) | Required |
| `/batch-tracking/expiring` | GET | Get expiring batches | Required |

## 📊 Response Examples

### Batch Details
```json
{
  "batchNumber": "BATCH001",
  "item": {
    "id": 123,
    "name": "Product Name"
  },
  "quantities": {
    "received": 1000,
    "issued": 300,
    "available": 700,
    "reserved": 0,
    "percentageUsed": 30
  },
  "dates": {
    "manufacture": "2024-01-01",
    "expiry": "2025-12-31",
    "daysToExpiry": 392
  },
  "location": {
    "distributorId": 5,
    "distributorName": "ABC Distributors",
    "city": "Mumbai",
    "state": "Maharashtra",
    "warehouseId": null
  },
  "status": {
    "isBlocked": false,
    "isExpired": false,
    "overall": "ACTIVE"
  }
}
```

### Distributor Summary
```json
{
  "distributorId": 5,
  "batches": [
    {
      "batchNumber": "BATCH001",
      "itemName": "Product Name",
      "receivedQty": 1000,
      "issuedQty": 300,
      "availableQty": 700,
      "expiryDate": "2025-12-31",
      "daysToExpiry": 392,
      "status": "ACTIVE"
    }
  ],
  "summary": {
    "totalBatches": 15,
    "totalAvailable": 12500,
    "expiringCount": 2,
    "expiredCount": 0,
    "blockedCount": 0
  }
}
```

## 🎯 Common Use Cases

### 1. Track a Specific Batch
```bash
GET /batch-tracking/batch/BATCH001
```
**Use:** Customer inquiry, quality issue tracking, recall management

### 2. View Distributor Inventory
```bash
GET /batch-tracking/distributor/5
```
**Use:** Distributor dashboard, inventory planning, stock visibility

### 3. Monitor Expiring Stock
```bash
GET /batch-tracking/expiring?days=30
```
**Use:** Expiry alerts, FIFO planning, wastage prevention

### 4. Admin Overview
```bash
GET /batch-tracking/all-batches
```
**Use:** System-wide monitoring, inventory reports, analytics

## 🔍 Query Parameters

### Expiring Batches Endpoint
```
GET /batch-tracking/expiring?days=30&distributorId=5
```

**Parameters:**
- `days` (optional): Days threshold (default: 30)
- `distributorId` (optional): Filter by specific distributor

## 📱 Status Values

| Status | Meaning |
|--------|---------|
| `ACTIVE` | Normal batch with available stock |
| `EXPIRING_SOON` | Expires within 30 days |
| `EXPIRED` | Past expiry date |
| `SOLD_OUT` | No available quantity |
| `BLOCKED` | Manually blocked batch |

## 🚨 Urgency Levels (Expiring Batches)

| Urgency | Days to Expiry |
|---------|----------------|
| `EXPIRED` | < 0 (already expired) |
| `CRITICAL` | 0-7 days |
| `HIGH` | 8-15 days |
| `MEDIUM` | 16-30 days |

## 💻 Development

### Run Server
```bash
cd order-management
npm run start:dev
```

### Build
```bash
npm run build
```

### Check Logs
Server logs show all batch tracking requests in real-time.

## 📚 Full Documentation

- **BATCH_TRACKING_READY.md** - Complete API documentation
- **FINAL_DELIVERY_SUMMARY.md** - Implementation summary
- **PHASE2_COMPLETION_SUMMARY.md** - Technical details

## ✅ Checklist for Production

- [ ] Test all endpoints with real data
- [ ] Verify authentication works
- [ ] Check performance with large datasets
- [ ] Test error scenarios
- [ ] Update frontend to use new APIs
- [ ] Train users on new features
- [ ] Monitor API usage
- [ ] Set up alerts for expiring batches

## 🎉 You're Ready!

The batch tracking system is live and ready to use. Start with the Quick Test above, then integrate with your frontend.

**Need Help?** Check the full documentation files listed above.
