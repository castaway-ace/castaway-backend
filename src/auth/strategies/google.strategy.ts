import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, VerifyCallback, Profile } from "passport-google-oauth20";

export interface GoogleUser {
  provider: "google";
  providerId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar: string;
  accessToken: string;
  refreshToken: string | undefined;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
  constructor() {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      callbackURL: process.env.GOOGLE_CALLBACK_URL || "",
      scope: ["email", "profile"],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string | undefined,
    profile: Profile,
    done: VerifyCallback
  ): Promise<void> {
    const { id, name, emails, photos } = profile;

    const user: GoogleUser = {
      provider: "google",
      providerId: id,
      email: emails?.[0].value || "",
      firstName: name?.givenName || "",
      lastName: name?.familyName || "",
      avatar: photos?.[0]?.value || "",
      accessToken,
      refreshToken,
    };

    done(null, user);
  }
}