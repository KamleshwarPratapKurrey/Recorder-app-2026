import { Colors } from "@/src/constants/theme";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";
import { Appearance } from "react-native";

type Theme = "light" | "dark";

type ThemeContextType = {
  theme: Theme;
  colors: typeof Colors.light;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemTheme = Appearance.getColorScheme() as Theme;

  const [theme, setTheme] = useState<Theme>(systemTheme || "light");

  // Load saved theme
  useEffect(() => {
    async function loadTheme() {
      const savedTheme = await AsyncStorage.getItem("theme");

      if (savedTheme) {
        setTheme(savedTheme as Theme);
      }
    }

    loadTheme();
  }, []);

  // Save theme when changed
  useEffect(() => {
    AsyncStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  const value: ThemeContextType = {
    theme,
    colors: Colors[theme],
    toggleTheme,
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

// Hook
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }
  return context;
}
