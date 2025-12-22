import { Controller, Get, Query, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiOkResponse,
} from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { ExtendedRequest } from 'src/common/middleware/jwt.middleware';

@ApiBearerAuth('authorization')
@ApiTags('Reports')
@Controller('reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('manager-wise-sales')
  @ApiOperation({ summary: 'Manager-wise Sales Report' })
  @ApiQuery({ name: 'fromDate', required: false })
  @ApiQuery({ name: 'toDate', required: false })
  @ApiQuery({ name: 'distributorId', required: false, type: 'number' })
  async getManagerWiseSales(
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('distributorId') distributorId?: string,
  ) {
    const from = fromDate ? new Date(fromDate) : new Date();
    const to = toDate ? new Date(toDate) : new Date();
    const distId = distributorId ? parseInt(distributorId) : undefined;
    const data = await this.reportsService.getManagerWiseSales(
      from,
      to,
      distId,
    );
    return { data, message: 'Manager-wise sales report' };
  }

  @Get('area-wise-sales')
  @ApiOperation({ summary: 'Area-wise Sales Report' })
  @ApiQuery({ name: 'fromDate', required: false })
  @ApiQuery({ name: 'toDate', required: false })
  @ApiQuery({ name: 'distributorId', required: false, type: 'number' })
  async getAreaWiseSales(
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('distributorId') distributorId?: string,
  ) {
    const from = fromDate ? new Date(fromDate) : new Date();
    const to = toDate ? new Date(toDate) : new Date();
    const distId = distributorId ? parseInt(distributorId) : undefined;
    const data = await this.reportsService.getAreaWiseSales(from, to, distId);
    return { data, message: 'Area-wise sales report' };
  }

  @Get('item-wise-sales')
  @ApiOperation({ summary: 'Item-wise Sales Report' })
  @ApiQuery({ name: 'fromDate', required: false })
  @ApiQuery({ name: 'toDate', required: false })
  @ApiQuery({ name: 'distributorId', required: false, type: 'number' })
  async getItemWiseSales(
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('distributorId') distributorId?: string,
  ) {
    const from = fromDate ? new Date(fromDate) : new Date();
    const to = toDate ? new Date(toDate) : new Date();
    const distId = distributorId ? parseInt(distributorId) : undefined;
    const data = await this.reportsService.getItemWiseSales(from, to, distId);
    return { data, message: 'Item-wise sales report' };
  }

  @Get('pending-payment-distributor')
  @ApiOperation({ summary: 'Pending Payment Report' })
  @ApiQuery({ name: 'fromDate', required: false })
  @ApiQuery({ name: 'toDate', required: false })
  @ApiQuery({ name: 'distributorId', required: false, type: 'number' })
  async getPendingPaymentByDistributor(
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('distributorId') distributorId?: string,
  ) {
    const from = fromDate ? new Date(fromDate) : new Date();
    const to = toDate ? new Date(toDate) : new Date();
    const distId = distributorId ? parseInt(distributorId) : undefined;
    const data = await this.reportsService.getPendingPaymentByDistributor(
      from,
      to,
      distId,
    );
    return { data, message: 'Pending payment by distributor report' };
  }

  @Get('top-customers')
  @ApiOperation({ summary: 'Top Customers Report' })
  @ApiQuery({ name: 'fromDate', required: false })
  @ApiQuery({ name: 'toDate', required: false })
  @ApiQuery({ name: 'limit', required: false, type: 'number' })
  @ApiQuery({ name: 'distributorId', required: false, type: 'number' })
  async getTopCustomerSales(
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('limit') limit?: string,
    @Query('distributorId') distributorId?: string,
  ) {
    const from = fromDate ? new Date(fromDate) : new Date();
    const to = toDate ? new Date(toDate) : new Date();
    const limitNum = limit ? parseInt(limit) : 20;
    const distId = distributorId ? parseInt(distributorId) : undefined;
    const data = await this.reportsService.getTopCustomerSales(
      from,
      to,
      limitNum,
      distId,
    );
    return { data, message: 'Top customers sales report' };
  }

  @Get('payment-status-summary')
  @ApiOperation({ summary: 'Payment Status Summary' })
  @ApiQuery({ name: 'fromDate', required: false })
  @ApiQuery({ name: 'toDate', required: false })
  @ApiQuery({ name: 'distributorId', required: false, type: 'number' })
  async getPaymentStatusSummary(
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('distributorId') distributorId?: string,
  ) {
    const from = fromDate ? new Date(fromDate) : new Date();
    const to = toDate ? new Date(toDate) : new Date();
    const distId = distributorId ? parseInt(distributorId) : undefined;
    const data = await this.reportsService.getPaymentStatusSummary(
      from,
      to,
      distId,
    );
    return { data, message: 'Payment status summary report' };
  }

  @Get('gst-analysis')
  @ApiOperation({ summary: 'GST Analysis Report' })
  @ApiQuery({ name: 'fromDate', required: false })
  @ApiQuery({ name: 'toDate', required: false })
  @ApiQuery({ name: 'distributorId', required: false, type: 'number' })
  async getGSTAnalysis(
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('distributorId') distributorId?: string,
  ) {
    const from = fromDate ? new Date(fromDate) : new Date();
    const to = toDate ? new Date(toDate) : new Date();
    const distId = distributorId ? parseInt(distributorId) : undefined;
    const data = await this.reportsService.getGSTAnalysis(from, to, distId);
    return { data, message: 'GST analysis report' };
  }

  @Get('sales-by-distributor')
  @ApiOperation({ summary: 'Sales by Distributor' })
  @ApiQuery({ name: 'fromDate', required: false })
  @ApiQuery({ name: 'toDate', required: false })
  @ApiQuery({ name: 'distributorId', required: false, type: 'number' })
  async getSalesByDistributor(
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('distributorId') distributorId?: string,
  ) {
    const from = fromDate ? new Date(fromDate) : new Date();
    const to = toDate ? new Date(toDate) : new Date();
    const distId = distributorId ? parseInt(distributorId) : undefined;
    const data = await this.reportsService.getSalesByDistributor(
      from,
      to,
      distId,
    );
    return { data, message: 'Sales by distributor report' };
  }

  @Get('order-approval-analytics')
  @ApiOperation({ summary: 'Order Approval Analytics' })
  @ApiQuery({ name: 'fromDate', required: false })
  @ApiQuery({ name: 'toDate', required: false })
  @ApiQuery({ name: 'distributorId', required: false, type: 'number' })
  async getOrderApprovalAnalytics(
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('distributorId') distributorId?: string,
  ) {
    const from = fromDate ? new Date(fromDate) : new Date();
    const to = toDate ? new Date(toDate) : new Date();
    const distId = distributorId ? parseInt(distributorId) : undefined;
    const data = await this.reportsService.getOrderApprovalAnalytics(
      from,
      to,
      distId,
    );
    return { data, message: 'Order approval analytics report' };
  }

  @Get('state-city-wise-sales')
  @ApiOperation({ summary: 'State/City Wise Sales' })
  @ApiQuery({ name: 'fromDate', required: false })
  @ApiQuery({ name: 'toDate', required: false })
  @ApiQuery({ name: 'distributorId', required: false, type: 'number' })
  async getStateCityWiseSales(
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('distributorId') distributorId?: string,
  ) {
    const from = fromDate ? new Date(fromDate) : new Date();
    const to = toDate ? new Date(toDate) : new Date();
    const distId = distributorId ? parseInt(distributorId) : undefined;
    const data = await this.reportsService.getStateCityWiseSales(
      from,
      to,
      distId,
    );
    return { data, message: 'State/City wise sales report' };
  }

  @Get('category-wise-sales')
  @ApiOperation({ summary: 'Category Wise Sales' })
  @ApiQuery({ name: 'fromDate', required: false })
  @ApiQuery({ name: 'toDate', required: false })
  @ApiQuery({ name: 'distributorId', required: false, type: 'number' })
  async getCategoryWiseSales(
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('distributorId') distributorId?: string,
  ) {
    const from = fromDate ? new Date(fromDate) : new Date();
    const to = toDate ? new Date(toDate) : new Date();
    const distId = distributorId ? parseInt(distributorId) : undefined;
    const data = await this.reportsService.getCategoryWiseSales(
      from,
      to,
      distId,
    );
    return { data, message: 'Category wise sales report' };
  }

  @Get('top-items-by-quantity')
  @ApiOperation({ summary: 'Top Items by Quantity' })
  @ApiQuery({ name: 'fromDate', required: false })
  @ApiQuery({ name: 'toDate', required: false })
  @ApiQuery({ name: 'limit', required: false, type: 'number' })
  @ApiQuery({ name: 'distributorId', required: false, type: 'number' })
  async getTopItemsByQuantity(
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('limit') limit?: string,
    @Query('distributorId') distributorId?: string,
  ) {
    const from = fromDate ? new Date(fromDate) : new Date();
    const to = toDate ? new Date(toDate) : new Date();
    const limitNum = limit ? parseInt(limit) : 20;
    const distId = distributorId ? parseInt(distributorId) : undefined;
    const data = await this.reportsService.getTopItemsByQuantity(
      from,
      to,
      limitNum,
      distId,
    );
    return { data, message: 'Top items by quantity report' };
  }

  @Get('credit-limit-utilization')
  @ApiOperation({ summary: 'Credit Limit Utilization' })
  @ApiQuery({ name: 'fromDate', required: false })
  @ApiQuery({ name: 'toDate', required: false })
  @ApiQuery({ name: 'distributorId', required: false, type: 'number' })
  async getCreditLimitUtilization(
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('distributorId') distributorId?: string,
  ) {
    const from = fromDate ? new Date(fromDate) : new Date();
    const to = toDate ? new Date(toDate) : new Date();
    const distId = distributorId ? parseInt(distributorId) : undefined;
    const data = await this.reportsService.getCreditLimitUtilization(
      from,
      to,
      distId,
    );
    return { data, message: 'Credit limit utilization report' };
  }

  @Get('returns-refunds-summary')
  @ApiOperation({ summary: 'Returns & Refunds Summary' })
  @ApiQuery({ name: 'fromDate', required: false })
  @ApiQuery({ name: 'toDate', required: false })
  @ApiQuery({ name: 'distributorId', required: false, type: 'number' })
  async getReturnsRefundsSummary(
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('distributorId') distributorId?: string,
  ) {
    const from = fromDate ? new Date(fromDate) : new Date();
    const to = toDate ? new Date(toDate) : new Date();
    const distId = distributorId ? parseInt(distributorId) : undefined;
    const data = await this.reportsService.getReturnsRefundsSummary(
      from,
      to,
      distId,
    );
    return { data, message: 'Returns and refunds summary report' };
  }

  @Get('payment-recovery-rate')
  @ApiOperation({ summary: 'Payment Recovery Rate' })
  @ApiQuery({ name: 'fromDate', required: false })
  @ApiQuery({ name: 'toDate', required: false })
  @ApiQuery({ name: 'distributorId', required: false, type: 'number' })
  async getPaymentRecoveryRate(
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('distributorId') distributorId?: string,
  ) {
    const from = fromDate ? new Date(fromDate) : new Date();
    const to = toDate ? new Date(toDate) : new Date();
    const distId = distributorId ? parseInt(distributorId) : undefined;
    const data = await this.reportsService.getPaymentRecoveryRate(
      from,
      to,
      distId,
    );
    return { data, message: 'Payment recovery rate report' };
  }

  @Get('top-products-week')
  @ApiOperation({
    summary: 'Top 10 Products This Week',
    description: 'Get top 10 selling products for the current week',
  })
  @ApiQuery({
    name: 'fromDate',
    required: false,
    description: 'Start date (ISO format)',
  })
  @ApiQuery({
    name: 'toDate',
    required: false,
    description: 'End date (ISO format)',
  })
  @ApiQuery({
    name: 'period',
    required: false,
    description: 'Period: TODAY, WEEKLY, MONTHLY, YEARLY',
  })
  @ApiQuery({
    name: 'distributorId',
    required: false,
    type: 'number',
    description: 'Filter by distributor ID (user_master.id)',
  })
  @ApiOkResponse({ description: 'Report generated successfully' })
  async getTopProductsByWeek(
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('period') period?: string,
    @Query('distributorId') distributorId?: string,
    @Req() req?: ExtendedRequest,
  ) {
    const from = fromDate
      ? new Date(fromDate)
      : new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000);
    const to = toDate ? new Date(toDate) : new Date();
    const userId = req?.userDetails?.userId;
    const userRole = req?.userDetails?.role;
    const distId = distributorId ? parseInt(distributorId) : undefined;
    const data = await this.reportsService.getTopProductsByWeek(
      from,
      to,
      userId,
      userRole,
      period,
      distId,
    );
    return { data, message: 'Top products this week report' };
  }

  @Get('top-products-month')
  @ApiOperation({
    summary: 'Top 10 Products This Month',
    description: 'Get top 10 selling products for a specific month',
  })
  @ApiQuery({
    name: 'month',
    required: false,
    type: 'number',
    description: 'Month (1-12), default is current',
  })
  @ApiQuery({
    name: 'year',
    required: false,
    type: 'number',
    description: 'Year, default is current',
  })
  @ApiQuery({
    name: 'distributorId',
    required: false,
    type: 'number',
    description: 'Filter by distributor ID (user_master.id)',
  })
  @ApiOkResponse({ description: 'Report generated successfully' })
  async getTopProductsByMonth(
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('distributorId') distributorId?: string,
    @Req() req?: ExtendedRequest,
  ) {
    const m = month ? parseInt(month) : new Date().getMonth() + 1;
    const y = year ? parseInt(year) : new Date().getFullYear();
    const userId = req?.userDetails?.userId;
    const userRole = req?.userDetails?.role;
    const distId = distributorId ? parseInt(distributorId) : undefined;
    const data = await this.reportsService.getTopProductsByMonth(
      m,
      y,
      userId,
      userRole,
      distId,
    );
    return { data, message: 'Top products this month report' };
  }

  @Get('top-products-year')
  @ApiOperation({
    summary: 'Top 10 Products This Year',
    description: 'Get top 10 selling products for a specific year',
  })
  @ApiQuery({
    name: 'year',
    required: false,
    type: 'number',
    description: 'Year, default is current',
  })
  @ApiQuery({
    name: 'distributorId',
    required: false,
    type: 'number',
    description: 'Filter by distributor ID (user_master.id)',
  })
  @ApiOkResponse({ description: 'Report generated successfully' })
  async getTopProductsByYear(
    @Query('year') year?: string,
    @Query('distributorId') distributorId?: string,
    @Req() req?: ExtendedRequest,
  ) {
    const y = year ? parseInt(year) : new Date().getFullYear();
    const userId = req?.userDetails?.userId;
    const userRole = req?.userDetails?.role;
    const distId = distributorId ? parseInt(distributorId) : undefined;
    const data = await this.reportsService.getTopProductsByYear(
      y,
      userId,
      userRole,
      distId,
    );
    return { data, message: 'Top products this year report' };
  }

  @Get('top-distributors-sales')
  @ApiOperation({
    summary: 'Top 10 Distributors by Sales',
    description: 'Get top 10 distributors with highest sales',
  })
  @ApiQuery({
    name: 'fromDate',
    required: false,
    description: 'Start date (ISO format)',
  })
  @ApiQuery({
    name: 'toDate',
    required: false,
    description: 'End date (ISO format)',
  })
  @ApiOkResponse({ description: 'Report generated successfully' })
  async getTop10DistributorsBySales(
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    const from = fromDate
      ? new Date(fromDate)
      : new Date(new Date().getFullYear(), 0, 1);
    const to = toDate ? new Date(toDate) : new Date();
    const data = await this.reportsService.getTop10DistributorsBySales(
      from,
      to,
    );
    return { data, message: 'Top 10 distributors by sales report' };
  }

  @Get('least-performing-distributors')
  @ApiOperation({
    summary: 'Least Performing Distributors',
    description: 'Get distributors with lowest sales',
  })
  @ApiQuery({
    name: 'fromDate',
    required: false,
    description: 'Start date (ISO format)',
  })
  @ApiQuery({
    name: 'toDate',
    required: false,
    description: 'End date (ISO format)',
  })
  @ApiOkResponse({ description: 'Report generated successfully' })
  async getLeastPerformingDistributors(
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    const from = fromDate
      ? new Date(fromDate)
      : new Date(new Date().getFullYear(), 0, 1);
    const to = toDate ? new Date(toDate) : new Date();
    const data = await this.reportsService.getLeastPerformingDistributors(
      from,
      to,
    );
    return { data, message: 'Least performing distributors report' };
  }

  @Get('crop-wise-sales')
  @ApiOperation({
    summary: 'Crop-wise Sales Report',
    description: 'Get sales report grouped by crop',
  })
  @ApiQuery({
    name: 'fromDate',
    required: false,
    description: 'Start date (ISO format)',
  })
  @ApiQuery({
    name: 'toDate',
    required: false,
    description: 'End date (ISO format)',
  })
  @ApiQuery({
    name: 'distributorId',
    required: false,
    type: 'number',
    description: 'Filter by distributor ID',
  })
  @ApiOkResponse({ description: 'Report generated successfully' })
  async getCropWiseSales(
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('distributorId') distributorId?: string,
    @Req() req?: ExtendedRequest,
  ) {
    const from = fromDate
      ? new Date(fromDate)
      : new Date(new Date().getFullYear(), 0, 1);
    const to = toDate ? new Date(toDate) : new Date();
    const userId = req?.userDetails?.userId;
    const userRole = req?.userDetails?.role;
    const distId = distributorId ? parseInt(distributorId) : undefined;
    const data = await this.reportsService.getCropWiseSales(
      from,
      to,
      userId,
      userRole,
      distId,
    );
    return { data, message: 'Crop-wise sales report' };
  }

  @Get('disease-wise-sales')
  @ApiOperation({
    summary: 'Disease-wise Sales Report',
    description: 'Get sales report grouped by disease/pest',
  })
  @ApiQuery({
    name: 'fromDate',
    required: false,
    description: 'Start date (ISO format)',
  })
  @ApiQuery({
    name: 'toDate',
    required: false,
    description: 'End date (ISO format)',
  })
  @ApiQuery({
    name: 'distributorId',
    required: false,
    type: 'number',
    description: 'Filter by distributor ID',
  })
  @ApiOkResponse({ description: 'Report generated successfully' })
  async getDiseaseWiseSales(
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('distributorId') distributorId?: string,
    @Req() req?: ExtendedRequest,
  ) {
    const from = fromDate
      ? new Date(fromDate)
      : new Date(new Date().getFullYear(), 0, 1);
    const to = toDate ? new Date(toDate) : new Date();
    const userId = req?.userDetails?.userId;
    const userRole = req?.userDetails?.role;
    const distId = distributorId ? parseInt(distributorId) : undefined;
    const data = await this.reportsService.getDiseaseWiseSales(
      from,
      to,
      userId,
      userRole,
      distId,
    );
    return { data, message: 'Disease-wise sales report' };
  }

  @Get('crop-disease-sales')
  @ApiOperation({
    summary: 'Crop & Disease Combined Sales Report',
    description: 'Get combined crop and disease sales report',
  })
  @ApiQuery({
    name: 'fromDate',
    required: false,
    description: 'Start date (ISO format)',
  })
  @ApiQuery({
    name: 'toDate',
    required: false,
    description: 'End date (ISO format)',
  })
  @ApiQuery({
    name: 'distributorId',
    required: false,
    type: 'number',
    description: 'Filter by distributor ID',
  })
  @ApiOkResponse({ description: 'Report generated successfully' })
  async getCropDiseaseSales(
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('distributorId') distributorId?: string,
    @Req() req?: ExtendedRequest,
  ) {
    const from = fromDate
      ? new Date(fromDate)
      : new Date(new Date().getFullYear(), 0, 1);
    const to = toDate ? new Date(toDate) : new Date();
    const userId = req?.userDetails?.userId;
    const userRole = req?.userDetails?.role;
    const distId = distributorId ? parseInt(distributorId) : undefined;
    const data = await this.reportsService.getCropDiseaseSales(
      from,
      to,
      userId,
      userRole,
      distId,
    );
    return { data, message: 'Crop & Disease combined sales report' };
  }

  @Get('expiring-items')
  @ApiOperation({ summary: 'Get top expiring items' })
  async getExpiringItems(
    @Query('days') days?: string,
    @Query('distributorId') distributorId?: string,
    @Query('limit') limit?: string,
    @Req() req?: any,
  ) {
    const userRole = req?.userDetails?.role;
    const userId = req?.userDetails?.id;
    let distId = distributorId ? parseInt(distributorId) : undefined;
    if (!distId && userRole === 'distributor') {
      distId = userId;
    }
    const data = await this.reportsService.getExpiringItems(
      days ? parseInt(days) : 30,
      distId,
      limit ? parseInt(limit) : 5,
    );
    return { data, message: 'Expiring items report' };
  }

  @Get('daily-sales-trend')
  @ApiOperation({ summary: 'Get daily sales trend' })
  async getDailySalesTrend(
    @Query('days') days?: string,
    @Query('distributorId') distributorId?: string,
    @Req() req?: any,
  ) {
    const userRole = req?.userDetails?.role;
    const userId = req?.userDetails?.id;
    let distId = distributorId ? parseInt(distributorId) : undefined;
    if (!distId && userRole === 'distributor') {
      distId = userId;
    }
    const data = await this.reportsService.getDailySalesTrend(
      days ? parseInt(days) : 7,
      distId,
    );
    return { data, message: 'Daily sales trend' };
  }

  @Get('weekly-summary')
  @ApiOperation({ summary: 'Get weekly sales summary' })
  async getWeeklySalesSummary(
    @Query('distributorId') distributorId?: string,
    @Req() req?: any,
  ) {
    const userRole = req?.userDetails?.role;
    const userId = req?.userDetails?.id;
    let distId = distributorId ? parseInt(distributorId) : undefined;
    if (!distId && userRole === 'distributor') {
      distId = userId;
    }
    const data = await this.reportsService.getWeeklySalesSummary(distId);
    return { data, message: 'Weekly sales summary' };
  }

  @Get('monthly-summary')
  @ApiOperation({ summary: 'Get monthly sales summary' })
  async getMonthlySalesSummary(
    @Query('distributorId') distributorId?: string,
    @Req() req?: any,
  ) {
    const userRole = req?.userDetails?.role;
    const userId = req?.userDetails?.id;
    let distId = distributorId ? parseInt(distributorId) : undefined;
    if (!distId && userRole === 'distributor') {
      distId = userId;
    }
    const data = await this.reportsService.getMonthlySalesSummary(distId);
    return { data, message: 'Monthly sales summary' };
  }

  @Get('top-customers')
  @ApiOperation({ summary: 'Get top customers' })
  async getTopCustomers(
    @Query('period') period?: string,
    @Query('distributorId') distributorId?: string,
    @Query('limit') limit?: string,
    @Req() req?: any,
  ) {
    const userRole = req?.userDetails?.role;
    const userId = req?.userDetails?.id;
    let distId = distributorId ? parseInt(distributorId) : undefined;
    if (!distId && userRole === 'distributor') {
      distId = userId;
    }
    const validPeriod = ['daily', 'weekly', 'monthly', 'yearly'].includes(
      period || '',
    )
      ? (period as 'daily' | 'weekly' | 'monthly' | 'yearly')
      : 'monthly';
    const data = await this.reportsService.getTopCustomers(
      validPeriod,
      distId,
      limit ? parseInt(limit) : 10,
    );
    return { data, message: 'Top customers report' };
  }

  @Get('po-summary')
  @ApiOperation({ summary: 'Get PO summary' })
  async getPOSummary(
    @Query('distributorId') distributorId?: string,
    @Req() req?: any,
  ) {
    const userRole = req?.userDetails?.role;
    const userId = req?.userDetails?.id;
    let distId = distributorId ? parseInt(distributorId) : undefined;
    if (!distId && userRole === 'distributor') {
      distId = userId;
    }
    const data = await this.reportsService.getPOSummary(distId);
    return { data, message: 'PO summary' };
  }
}
