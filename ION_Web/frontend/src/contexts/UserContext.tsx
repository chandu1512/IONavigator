import React, { createContext, useContext, useEffect, useState } from 'react';

type Ctx = {
  userId: string | null;
  email: string | null;
  setUserId: (id: string | null) => void;
  setAuth: (id: string, email: string) => void;
  logout: () => void;
};

const C = createContext<Ctx | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userId, setUserIdState] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    setUserIdState(localStorage.getItem('userId'));
    setEmail(localStorage.getItem('userEmail'));
  }, []);

  useEffect(() => {
    if (userId) localStorage.setItem('userId', userId);
    else localStorage.removeItem('userId');
  }, [userId]);

  const setUserId = (id: string | null) => setUserIdState(id);

  const setAuth = (id: string, em: string) => {
    setUserIdState(id);
    setEmail(em);
    localStorage.setItem('userId', id);
    localStorage.setItem('userEmail', em);
  };

  const logout = () => {
    setUserIdState(null);
    setEmail(null);
    localStorage.removeItem('userId');
    localStorage.removeItem('userEmail');
  };

  return (
    <C.Provider value={{ userId, email, setUserId, setAuth, logout }}>
      {children}
    </C.Provider>
  );
};

export const useUser = () => {
  const ctx = useContext(C);
  if (!ctx) throw new Error('useUser must be used within UserProvider');
  return ctx;
};
