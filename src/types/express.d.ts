export interface AuthenticatedAdmin {
  id: string;
  name: string;
  email: string;
  role: 'admin';
}

declare global {
  namespace Express {
    interface Request {
      admin?: AuthenticatedAdmin;
    }
  }
}
