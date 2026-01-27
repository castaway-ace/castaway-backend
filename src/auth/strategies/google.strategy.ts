import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private config: ConfigService) {
    super({
      clientID: config.get<string>('auth.google.clientID', ''),
      clientSecret: config.get<string>('auth.google.clientSecret', ''),
      callbackURL: config.get<string>('auth.google.callbackURL', ''),
      scope: ['email', 'profile'],
    });
  }

  validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): any {
    const { id, name, emails, photos } = profile;

    const user = {
      provider: 'google',
      providerId: id,
      email: emails && emails[0] ? emails[0].value : null,
      name: `${name?.givenName} ${name?.familyName}`,
      avatar: photos && photos[0] ? photos[0].value : null,
      accessToken,
      refreshToken,
    };

    done(null, user);
  }
}
