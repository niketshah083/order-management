import { Controller, Get, Param, Query } from '@nestjs/common';
import { PincodesService } from './pincodes.service';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';

@ApiTags('Pincodes')
@Controller('pincodes')
export class PincodesController {
  constructor(private pincodesService: PincodesService) {}

  @Get('lookup/:pincode')
  @ApiOperation({ summary: 'Lookup city, state, and country by pincode' })
  @ApiParam({ name: 'pincode', description: 'Indian pincode (6 digits)', example: '110001' })
  async lookupPincode(@Param('pincode') pincode: string) {
    const locationData = await this.pincodesService.getLocationByPincode(pincode);
    
    if (!locationData) {
      return {
        statusCode: 404,
        message: 'Pincode not found',
        data: null,
      };
    }

    return {
      statusCode: 200,
      message: 'Pincode found',
      data: locationData,
    };
  }
}
