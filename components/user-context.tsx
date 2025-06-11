"use client";

import { createContext, useContext, useEffect, useState } from "react";

import { getUser } from "@/app/actions/get-user";

export type User = { id: string; email: string };

export type UserContextType = {
  user: User | null;
  updateUser: () => Promise<void>;
};

export const UserContext = createContext<UserContextType | null>(null);

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
};

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);

  const fetchUser = async () => {
    try {
      const res = await getUser();
      if (!(res instanceof Error)) return setUser(res);
      console.error(res.message);
      setUser(null);
    } catch (error) {
      console.error("Error fetching user:", error);
      setUser(null);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const value = {
    user,
    updateUser: fetchUser,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};
