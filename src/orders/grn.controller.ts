import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Req,
} from '@nestjs/common';
import { GrnService } from './grn.service';
import { CreateGrnDto } from './dto/create-grn.dto';
import { ExtendedRequest } from 'src/common/middleware/jwt.middleware';

@Controller('grn')
export class GrnController {
  constructor(private grnService: GrnService) {}

  @Post()
  async createGrn(@Body() dto: CreateGrnDto, @Req() req: ExtendedRequest) {
    const data = await this.grnService.createGrn(dto, req);
    return { statusCode: 201, data, message: 'GRN created successfully' };
  }

  @Get(':id')
  async getGrnDetail(@Param('id') id: number, @Req() req: ExtendedRequest) {
    const data = await this.grnService.getGrnDetail(id, req);
    if (!data) {
      throw new Error('GRN not found');
    }
    return { statusCode: 200, data, message: 'GRN details retrieved successfully' };
  }

  @Get('po/:poId')
  async getGrnsByPo(@Param('poId') poId: number) {
    return await this.grnService.getGrnsByPo(poId);
  }

  @Get('list')
  async listGrns(@Req() req: ExtendedRequest) {
    const role = req.userDetails?.role;
    const userId = req.userDetails?.userId;
    
    if (!role || !userId) {
      throw new Error('Unauthorized: Invalid user details');
    }
    
    if (role === 'distributor') {
      // Distributors can only see their own GRNs
      const data = await this.grnService.listGrnsForDistributor(
        userId,
        req.query.search as string,
      );
      return { statusCode: 200, data, message: 'GRNs retrieved successfully' };
    } else {
      // Admins/Managers can see all GRNs
      const data = await this.grnService.listAllGrns(req.query.search as string);
      return { statusCode: 200, data, message: 'GRNs retrieved successfully' };
    }
  }

  @Get('distributor/list/:distributorId')
  async listGrnsForDistributor(
    @Param('distributorId') distributorId: number,
    @Req() req: ExtendedRequest,
  ) {
    const data = await this.grnService.listGrnsForDistributor(
      distributorId,
      req.query.search as string,
    );
    return { statusCode: 200, data, message: 'GRNs retrieved successfully' };
  }

  @Patch(':id/approve')
  async approveGrn(@Param('id') id: number, @Req() req: ExtendedRequest) {
    const data = await this.grnService.approveGrn(id, req);
    return { statusCode: 200, data, message: 'GRN approved successfully' };
  }

  @Patch(':id/quantities')
  async updateGrnQuantities(
    @Param('id') id: number,
    @Body() updates: any,
    @Req() req: ExtendedRequest,
  ) {
    const data = await this.grnService.updateGrnQuantities(id, updates, req);
    return { statusCode: 200, data, message: 'GRN quantities updated successfully' };
  }

  @Patch('po/:poId/close')
  async closePo(@Param('poId') poId: number, @Req() req: ExtendedRequest) {
    return await this.grnService.closePo(poId, req);
  }

  @Post('po/:poId/split')
  async splitPo(
    @Param('poId') poId: number,
    @Body() body: { items: number[] },
    @Req() req: ExtendedRequest,
  ) {
    return await this.grnService.splitPo(poId, body.items, req);
  }
}
