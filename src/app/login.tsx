import { useUser } from "@/src/context/UserContext";
import { useRouter } from "expo-router";
import { Button, Text, View } from "react-native";

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useUser();

  const handleLogin = async () => {
    try {
      // 🔥 Replace with real API call
      const fakeResponse = {
        token: "abc123",
        user: {
          id: "1",
          name: "DevelopedByKPK",
          email: "developedbykpk@gmail.com",
        },
      };

      await login(fakeResponse.token, fakeResponse.user);

      // ✅ go to tabs
      router.replace("/(tabs)/home");
    } catch (e) {
      console.log("Login error", e);
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>Login Screen</Text>
      <Button title="Login" onPress={handleLogin} />
    </View>
  );
}
