import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react'; // Menggunakan type-only import
import { apiClient } from '../api/apiClient';

export interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: 'ADMIN' | 'OPERATOR' | 'VIEWER';
  department?: string;
  whatsappNumber?: string;
  menuAccess?: string[];
}

export interface UseAuthResult {
  user: User | null;
  login: (user: User, remember: boolean) => void;
  logout: () => Promise<void>;
  loading: boolean; 
}

const AuthContext = createContext<UseAuthResult | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await apiClient.get('/api/auth/me');
        if (response.data) {
          const userData = {
            ...response.data,
            id: String(response.data.id)
          };
          setUser(userData);
        }
      } catch (error) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = (userData: User, remember: boolean) => {
    setUser(userData);
    // Suppress unused variable warning jika logika remember belum dipakai
    if (remember) { 
      // Placeholder: Implementasi remember me client-side jika diperlukan
    }
  };

  const logout = async () => {
    try {
      await apiClient.post('/api/auth/logout');
    } catch (error) {
      console.error('Logout error', error);
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): UseAuthResult => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};