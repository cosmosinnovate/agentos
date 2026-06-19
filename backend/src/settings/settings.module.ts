import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { ProviderConfig } from './entities/provider-config.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProviderConfig]),
    ConfigModule,
  ],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
