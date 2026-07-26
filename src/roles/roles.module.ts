import { Module } from '@nestjs/common';
import { RolesController } from './roles.controller.js';
import { RolesService } from './roles.service.js';
import { UsersModule } from '../users/users.module.js';
import { RefreshTokenModule } from '../refresh-token/refresh-token.module.js';

@Module({
  imports: [UsersModule, RefreshTokenModule],
  controllers: [RolesController],
  providers: [RolesService],
})
export class RolesModule {}
