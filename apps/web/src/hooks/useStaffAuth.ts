// Custom hook for staff authentication management

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { staffApiService } from '../services/staff-api';
import { StaffCredentials } from '../types/staff';

export const useStaffAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check authentication status on mount
    const checkAuth = () => {
      const authenticated = staffApiService.isAuthenticated();
      setIsAuthenticated(authenticated);
      
      if (authenticated) {
        setUsername(staffApiService.getUsername());
      }
      
      setLoading(false);
    };

    checkAuth();

    // Set up periodic auth check (every 5 minutes)
    const interval = setInterval(checkAuth, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const login = async (credentials: StaffCredentials): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await staffApiService.login(credentials);
      
      if (result.success) {
        setIsAuthenticated(true);
        setUsername(result.data?.username || null);
        return { success: true };
      } else {
        return { 
          success: false, 
          error: result.error?.message || 'Login failed' 
        };
      }
    } catch (error) {
      return { 
        success: false, 
        error: 'Network error. Please try again.' 
      };
    }
  };

  const logout = async () => {
    await staffApiService.logout();
    setIsAuthenticated(false);
    setUsername(null);
    router.push('/staff/login');
  };

  const requireAuth = () => {
    if (!loading && !isAuthenticated) {
      router.push('/staff/login');
    }
  };

  return {
    isAuthenticated,
    username,
    loading,
    login,
    logout,
    requireAuth,
  };
};