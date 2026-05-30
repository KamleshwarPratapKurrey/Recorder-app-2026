import { useUser } from "@/src/context/UserContext";
import { Redirect, Tabs } from "expo-router";

export default function TabLayout() {
  const { user, loading } = useUser();

  if (loading) return null;

  // 🔒 Protect all tab screens
  if (!user) {
    return <Redirect href="/login" />;
  }

  return <Tabs />;
}
