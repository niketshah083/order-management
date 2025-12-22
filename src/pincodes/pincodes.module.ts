import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PincodesService } from './pincodes.service';
import { PincodesController } from './pincodes.controller';

@Module({
  imports: [HttpModule],
  providers: [PincodesService],
  controllers: [PincodesController],
})
export class PincodesModule {}
