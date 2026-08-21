export type AuthState = 'unknown' | 'initializing' | 'authenticated' | 'unauthenticated' | 'suspended';

export interface User {
  id: string;
  publicId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface TenantInfo {
  id: string;
  publicId: string;
  name: string;
  slug: string;
  subscriptionPlan: string;
  status: string;
}

export interface ClinicInfo {
  id: string;
  publicId: string;
  name: string;
  slug: string;
  status: string;
}

export interface SubscriptionInfo {
  plan: string;
  status: string;
}

export interface AuthContextType {
  user: User | null;
  roles: string[];
  permissions: string[];
  tenant: TenantInfo | null;
  clinic: ClinicInfo | null;
  loading: boolean;
  authState: AuthState;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (payload: any) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (payload: any) => Promise<void>;
  verifyEmail: (token: string) => Promise<void>;
  resendVerification: (email: string) => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
  updateClinicContext: (updates: Partial<ClinicInfo>) => void;
  refreshSession: () => Promise<void>;
}
