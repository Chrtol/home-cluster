import { AuthProvider, useAuth } from "react-oidc-context";
import { setupInterceptors } from "./api/axios";

import Home from "./components/Home";
import FeedingLog from "./components/FeedingLog";
import FoodManagement from "./components/FoodManagement";
import Calendar from "./components/Calendar";
import Statistics from "./components/Statistics";
import SupplementManagement from "./components/SupplementManagement";

const oidcConfig = {
  // ...existing config
  scope: "openid profile email offline_access",
};

function AuthenticatedApp() {
  const auth = useAuth();
  setupInterceptors(auth);

  return (
    <Router>
      <div>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/reptiles/:reptileId/feeding" element={<FeedingLog />} />
          <Route path="/food" element={<FoodManagement />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/statistics" element={<Statistics />} />
          <Route path="/supplements" element={<SupplementManagement />} />
        </Routes>
      </div>
    </Router>
  );
}

function App() {
  return (
    <AuthProvider
      // ...existing provider props
    >
      <AuthenticatedApp />
    </AuthProvider>
  );
}

export default App;