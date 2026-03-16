import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import VideoDetail from "./components/VideoDetail";
import NotFound from "./pages/NotFound";
import UserProfile from "./pages/UserProfile";
import HiveToolbar from "./components/HiveToolbar";
import HiveContributionsLanding from "./components/landing-page/HiveContributionsLanding";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div style={{ paddingBottom: "70px" }}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route
              path="/contributions"
              element={
                <HiveContributionsLanding
                  backgroundColor="#020617"
                  textColor="#e5e7eb"
                  cardBackgroundColor="rgba(15,23,42,0.9)"
                  isDividerShow={true}
                  dividerColor="rgba(148,163,184,0.4)"
                />
              }
            />
            <Route path="/video/:author/:permlink" element={<VideoDetail />} />
            <Route path="/user/:username" element={<UserProfile />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
        <HiveToolbar />
      </BrowserRouter>
  </QueryClientProvider>
);

export default App;
