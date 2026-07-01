import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { AuthGuard } from './guards/auth.guard.js';
import { LoginDto } from './dto/login.dto.js';
import { SignUpDto } from './dto/sign-up.dto.js';
import { AuthTokensEntity } from './entities/auth-tokens.entity.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { Public } from './decorators/public.decorator.js';

@Controller('auth')
@ApiTags('Auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AuthTokensEntity })
  @ApiBadRequestResponse({ description: 'Invalid request body.' })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials.' })
  signIn(@Body() loginDto: LoginDto): Promise<AuthTokensEntity> {
    return this.authService.login(loginDto);
  }

  @Public()
  @Post('signup')
  @ApiCreatedResponse({ type: AuthTokensEntity })
  @ApiBadRequestResponse({
    description: 'Invalid request body or referral code.',
  })
  @ApiConflictResponse({ description: 'Email already registered.' })
  signup(@Body() signUpDto: SignUpDto): Promise<AuthTokensEntity> {
    return this.authService.signUp(signUpDto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AuthTokensEntity })
  @ApiUnauthorizedResponse({ description: 'Invalid or revoked refresh token.' })
  refresh(@Body() dto: RefreshTokenDto): Promise<AuthTokensEntity> {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  async logout(@Body() dto: RefreshTokenDto): Promise<void> {
    await this.authService.logout(dto.refreshToken);
  }
}
