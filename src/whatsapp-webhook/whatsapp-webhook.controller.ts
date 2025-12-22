import { Controller, Get, Post, Query, Req, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBody } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { WhatsappWebhookService } from './whatsapp-webhook.service';

@ApiTags('WhatsApp Webhook')
@Controller('whatsapp-webhook')
export class WhatsappWebhookController {
  constructor(
    private readonly whatsappWebhookService: WhatsappWebhookService,
  ) {}

  @Get()
  @ApiOperation({ 
    summary: 'Verify WhatsApp Webhook',
    description: 'Webhook verification endpoint for WhatsApp Business API setup'
  })
  @ApiQuery({ name: 'hub.mode', required: false, description: 'Hub mode (subscribe)' })
  @ApiQuery({ name: 'hub.challenge', required: false, description: 'Challenge token from WhatsApp' })
  @ApiQuery({ name: 'hub.verify_token', required: false, description: 'Verification token' })
  @ApiResponse({ status: 200, description: 'Webhook verified successfully' })
  @ApiResponse({ status: 403, description: 'Verification token mismatch - access denied' })
  async verifyWhatsappWebhook(
    @Query() query: any,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const {
      'hub.mode': mode,
      'hub.challenge': challenge,
      'hub.verify_token': token,
    } = query;

    console.log('query :: ', query);
    if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
      console.log('WEBHOOK VERIFIED');
      res.status(200).send(challenge);
    } else {
      res.status(403).end();
    }
  }

  @Post()
  @ApiOperation({ 
    summary: 'Receive WhatsApp Webhook Event',
    description: 'Receive and process incoming messages and events from WhatsApp Business API'
  })
  @ApiBody({ schema: { example: { entry: [{ changes: [{ value: { messages: [] } }] }] } } })
  @ApiResponse({ status: 200, description: 'Webhook event received and processed' })
  async receiveWhatsappWebhook(@Req() req: Request, @Res() res: Response) {
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    console.log(`\n\nWebhook received ${timestamp}\n`);
    console.log(JSON.stringify(req.body, null, 2));
    if (req.body?.entry?.[0]?.changes?.length) {
      this.whatsappWebhookService.onReceivedMessage(
        req.body.entry[0].changes[0],
      );
    }
    res.status(200).end();
  }
}
