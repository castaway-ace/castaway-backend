import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { StorageService } from '../storage/storage.service.js';

@Module({
  controllers: [AdminController],
  providers: [AdminService, JwtService, ConfigService, StorageService],
})
export class AdminModule {}
