declare global {
  namespace Express {
    interface Request {
      user: {
        sub: string;
        deviceId: string;
        isAdmin: boolean;
      };
    }
  }
}

export {};
