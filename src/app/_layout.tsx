import { ThemeProvider } from "@/src/context/ThemeContext";
import { UserProvider, useUser } from "@/src/context/UserContext";
import { Slot } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
// import { useFonts } from "expo-font";
// import { Provider as ReduxProvider } from "react-redux";
// import { store } from "@/store";

SplashScreen.preventAutoHideAsync();

function AppContent() {
  const { loading } = useUser();
  //   const [loaded] = useFonts({
  //   PoppinsRegular: require("../assets/fonts/Poppins-Regular.ttf"),
  //   PoppinsBold: require("../assets/fonts/Poppins-Bold.ttf"),
  // });

  useEffect(() => {
    if (!loading) {
      SplashScreen.hideAsync();
    }
  }, [loading]);

  // if (!loaded) {
  //   return null;
  // }
  if (loading) return null;

  return <Slot />;
}

export default function RootLayout() {
  return (
    // <ReduxProvider store={store}>
    <ThemeProvider>
      <UserProvider>
        <AppContent />
        <StatusBar style="auto" />
      </UserProvider>
    </ThemeProvider>
    // </ReduxProvider>
  );
}
