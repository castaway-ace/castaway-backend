import { ArgumentsHost, Catch, HttpStatus, Logger } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Response } from 'express';
import { Prisma } from '../generated/prisma/client.js';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaClientExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(PrismaClientExceptionFilter.name);

  catch(
    exception: Prisma.PrismaClientKnownRequestError,
    host: ArgumentsHost,
  ): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    switch (exception.code) {
      case 'P2002': {
        this.logger.warn(this.describe(exception));
        this.reply(
          response,
          HttpStatus.CONFLICT,
          `Unique constraint violation on: ${this.constraintTarget(exception)}`,
        );
        break;
      }
      case 'P2025': {
        this.logger.warn(this.describe(exception));
        this.reply(response, HttpStatus.NOT_FOUND, 'Record not found');
        break;
      }
      case 'P2003': {
        this.logger.warn(this.describe(exception));
        this.reply(
          response,
          HttpStatus.NOT_FOUND,
          'Referenced record not found',
        );
        break;
      }
      default:
        this.logger.error(this.describe(exception));
        super.catch(exception, host);
        break;
    }
  }
  private reply(response: Response, status: HttpStatus, message: string): void {
    response.status(status).json({ statusCode: status, message });
  }

  private describe(exception: Prisma.PrismaClientKnownRequestError): string {
    return `${exception.code}: ${exception.message.replace(/\n/g, ' ')}`;
  }

  private constraintTarget(
    exception: Prisma.PrismaClientKnownRequestError,
  ): string {
    const target = exception.meta?.target;
    if (Array.isArray(target)) return target.join(', ');
    if (typeof target === 'string') return target;
    return 'unknown field';
  }
}
