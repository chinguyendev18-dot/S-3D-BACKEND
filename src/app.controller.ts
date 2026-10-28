import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getApiInfo() {
    return {
      name: 'S-3D Backend',
      status: 'ok',
      version: '0.1.0',
    };
  }

  @Get('health')
  getHealth() {
    return { status: 'ok' };
  }
}
