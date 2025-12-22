# Restart Backend to Apply Changes

## Changes Made
Fixed boolean field transformations in Item DTO. The backend needs to be restarted to apply these changes.

## How to Restart

### If running in terminal:
1. Stop the current process: `Ctrl + C`
2. Restart: `npm run start:dev`

### If running as a service:
```bash
cd order-management
npm run start:dev
```

## Verify Changes Applied
After restart, test the item update:

```bash
# Update an item with boolean fields
curl 'http://localhost:4001/items/2' \
  -X 'PUT' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: multipart/form-data' \
  -F 'name=Test Item' \
  -F 'rate=10' \
  -F 'qty=100' \
  -F 'unit=pcs' \
  -F 'hasBatchTracking=true' \
  -F 'hasSerialTracking=true' \
  -F 'hasExpiryDate=false'

# Verify the update
curl 'http://localhost:4001/items/2' \
  -H 'Authorization: Bearer YOUR_TOKEN'
```

Check that the boolean fields are now `true`/`false` (not strings).
