"use client";

import { useApp } from '../../../contexts/AppContext';

export function useAuth() {
  const { user, userType, role, login, logout } = useApp();
  return { user, userType, role, login, logout, isAuthenticated: Boolean(user && userType) };
}
