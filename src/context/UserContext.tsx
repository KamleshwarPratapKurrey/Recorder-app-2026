import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import React, { createContext, useContext, useEffect, useState } from "react";

type User = {
  id: string;
  name: string;
  email: string;
};

type UserContextType = {
  user: User | null;
  loading: boolean;
  login: (token: string, userData: User) => Promise<void>;
  logout: () => Promise<void>;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Load user from storage on app start
  useEffect(() => {
    async function loadUser() {
      try {
        const storedUser = await AsyncStorage.getItem("user");
        const token = await SecureStore.getItemAsync("token");
        // console.log("Loaded token:", token);

        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
      } catch (e) {
        console.log("Error loading user:", e);
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, []);

  const login = async (token: string, userData: User) => {
    // await AsyncStorage.setItem("token", token);
    await SecureStore.setItemAsync("token", token);
    await AsyncStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
  };

  const logout = async () => {
    // await AsyncStorage.removeItem("token");
    // Delete token
    await SecureStore.deleteItemAsync("token");
    await AsyncStorage.removeItem("user");
    setUser(null);
  };

  return (
    <UserContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </UserContext.Provider>
  );
}

// Hook
export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used inside UserProvider");
  }
  return context;
}
