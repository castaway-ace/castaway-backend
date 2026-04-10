import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    super({
      clientID: config.get<string>('auth.google.clientID', ''),
      clientSecret: config.get<string>('auth.google.clientSecret', ''),
      callbackURL: config.get<string>('auth.google.callbackURL', ''),
      scope: ['email', 'profile'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): any {
    const { id, name, emails, photos } = profile;

    const user = {
      provider: 'google',
      providerId: id,
      email: emails && emails[0] ? emails[0].value : null,
      name: `${name?.givenName} ${name?.familyName}`,
      avatar: photos && photos[0] ? photos[0].value : null,
    };

    done(null, user);
  }
}
