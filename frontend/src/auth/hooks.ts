import { useContext } from 'react';
import { AuthContext } from './AuthProvider';
import type { AuthContextType } from './types';

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return context;
};
