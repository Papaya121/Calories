import { Request } from 'express';

export type AuthenticatedUser = {
  userId: string;
  sessionId: string;
};

export type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};
