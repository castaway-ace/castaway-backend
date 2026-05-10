// express.d.ts
declare global {
  namespace Express {
    interface Request {
      user: {
        sub: string;
        deviceId: string;
      };
    }
  }
}

export {};
