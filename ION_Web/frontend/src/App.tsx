import React from "react";
import { UserProvider, useUser } from "./contexts/UserContext";
import HomePage from "./pages/HomePage";
import AuthPage from "./pages/AuthPage";

const AppContent: React.FC = () => {
  const { userId } = useUser();
  return userId ? <HomePage /> : <AuthPage />;
};

export default function App() {
  return (
    <UserProvider>
      <AppContent />
    </UserProvider>
  );
}
