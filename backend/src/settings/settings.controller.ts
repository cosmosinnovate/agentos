import { Controller, Get, Post, Delete, Body, Param } from '@nestjs/common';
import { SettingsService } from './settings.service';

@Controller('api/v1/settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('providers')
  async listConfiguredProviders() {
    const configured = await this.settingsService.listConfiguredProviders();
    return { configured };
  }

  @Post('providers/:name')
  async setProviderApiKey(
    @Param('name') name: string,
    @Body('apiKey') apiKey: string,
  ) {
    if (!apiKey) {
      throw new Error('API Key is required');
    }
    await this.settingsService.setApiKey(name, apiKey);
    return { success: true };
  }

  @Delete('providers/:name')
  async deleteProviderApiKey(@Param('name') name: string) {
    await this.settingsService.deleteApiKey(name);
    return { success: true };
  }
}
