import {
  Controller,
  ExecutionContext,
  Get,
  INestApplication,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import type { App } from 'supertest/types.js';
import type { Request } from 'express';
import request from 'supertest';
import { PermissionsGuard } from './permissions.guard.js';
import { RequirePermissions } from '../decorators/permissions.decorator.js';
import { Permission } from '../rbac/permissions.js';
import { Role } from '../../generated/prisma/client.js';

// The roles the mock auth guard injects onto request.user for the next request.
let currentRoles: Role[] = [];

@Controller('test')
class ProbeController {
  @Get('open')
  open(): string {
    return 'open';
  }

  @Get('guarded')
  @RequirePermissions(Permission.CatalogWrite)
  guarded(): string {
    return 'guarded';
  }
}

/**
 * Exercises the real PermissionsGuard through the HTTP pipeline: a mock auth
 * guard populates request.user (mirroring AuthGuard), then the real
 * PermissionsGuard enforces @RequirePermissions. Proves the decorator +
 * reflection + role->permission resolution actually gate a request end to end.
 */
describe('PermissionsGuard (HTTP enforcement)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProbeController],
      providers: [
        // Registered before PermissionsGuard so request.user is set first.
        {
          provide: APP_GUARD,
          useValue: {
            canActivate: (context: ExecutionContext): boolean => {
              const req = context.switchToHttp().getRequest<Request>();
              req.user = { sub: 'u', deviceId: 'd', roles: currentRoles };
              return true;
            },
          },
        },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows an undecorated route regardless of roles', async () => {
    currentRoles = [];
    await request(app.getHttpServer()).get('/test/open').expect(200);
  });

  it('allows a caller whose role grants the required permission', async () => {
    currentRoles = [Role.ADMIN];
    await request(app.getHttpServer()).get('/test/guarded').expect(200);
  });

  it('forbids a caller whose roles lack the required permission', async () => {
    currentRoles = [Role.USER];
    await request(app.getHttpServer()).get('/test/guarded').expect(403);
  });
});
