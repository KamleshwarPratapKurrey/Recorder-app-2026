import { useUser } from "@/src/context/UserContext";
import { Redirect } from "expo-router";

export default function Index() {
  const { user, loading } = useUser();

  if (loading) return null;

  // return user ? <Redirect href="/(tabs)/home" /> : <Redirect href="/login" />;
  return <Redirect href="/home" />;
}
