import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-facebook';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  constructor(config: ConfigService) {
    super({
      clientID: config.get<string>('auth.facebook.appId', ''),
      clientSecret: config.get<string>('auth.facebook.appSecret', ''),
      callbackURL: config.get<string>('auth.facebook.callbackURL', ''),
      scope: ['email'],
      profileFields: ['emails', 'name', 'photos'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: (err: any, user: any, info?: any) => void,
  ): any {
    const { id, name, emails, photos } = profile;

    const user = {
      provider: 'facebook',
      providerId: id,
      email: emails && emails[0] ? emails[0].value : null,
      name: `${name?.givenName} ${name?.familyName}`,
      avatar: photos && photos[0] ? photos[0].value : null,
    };

    done(null, user);
  }
}
