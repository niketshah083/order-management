import { IsArray, IsDate, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateBillingDto {
  @IsOptional()
  @IsString()
  billNo?: string;

  @IsNotEmpty()
  @IsString()
  billDate: string;

  @IsNotEmpty({ message: 'Customer is required. Please select a customer before saving.' })
  @IsNumber({}, { message: 'Customer ID must be a valid number' })
  @Transform(({ value }) => {
    const num = Number(value);
    if (isNaN(num) || num <= 0) return undefined;
    return num;
  })
  customerId: number;

  @IsNotEmpty()
  @IsArray()
  items: {
    itemId: string;
    itemName: string;
    unit: string;
    quantity: number;
    rate: number;
    discount: number;
    discountType: 'percentage' | 'amount';
    taxableAmount: number;
    cgst: number;
    sgst: number;
    igst: number;
    totalAmount: number;
    batchNumber?: string;
    serialNumber?: string;
    expiryDate?: string;
    inventoryIds?: number[];
    orderedByBox?: boolean;
    boxCount?: number;
    boxRate?: number;
    unitsPerBox?: number;
  }[];

  @IsNotEmpty()
  @IsNumber()
  subtotal: number;

  @IsNotEmpty()
  @IsNumber()
  overallDiscount: number;

  @IsNotEmpty()
  @IsString()
  overallDiscountType: 'percentage' | 'amount';

  @IsNotEmpty()
  @IsNumber()
  totalAfterDiscount: number;

  @IsNotEmpty()
  @IsNumber()
  cgstTotal: number;

  @IsNotEmpty()
  @IsNumber()
  sgstTotal: number;

  @IsNotEmpty()
  @IsNumber()
  igstTotal: number;

  @IsNotEmpty()
  @IsNumber()
  grandTotal: number;

  @IsOptional()
  @IsNumber()
  roundOff?: number;

  @IsNotEmpty()
  @IsNumber()
  finalAmount: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  status?: 'draft' | 'completed';

  @IsOptional()
  @IsString()
  paymentType?: 'cash' | 'online' | 'credit';

  @IsOptional()
  @IsString()
  poNumber?: string;

  @IsOptional()
  @IsNumber()
  distributorId?: number;

  @IsOptional()
  @IsString()
  cropName?: string;

  @IsOptional()
  @IsString()
  cropDiseases?: string;
}
