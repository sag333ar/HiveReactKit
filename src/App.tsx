import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, useNavigate } from "react-router-dom";
import Index from "./pages/Index";
import VideoDetail from "./components/VideoDetail";
import NotFound from "./pages/NotFound";
import UserProfile from "./pages/UserProfile";
import UserDetailProfilePage from "./pages/UserDetailProfilePage";
import PostComposerPage from "./pages/PostComposerPage";
import HiveDetailPostPage from "./pages/HiveDetailPostPage";
import HiveContributionsLanding from "./components/landing-page/HiveContributionsLanding";
import ExpensesView from "./components/landing-page/ExpensesView";

const queryClient = new QueryClient();

const ContributionsPage = () => {
  const navigate = useNavigate();
  return (
    <HiveContributionsLanding
      backgroundColor="#020617"
      textColor="#e5e7eb"
      cardBackgroundColor="rgba(15,23,42,0.9)"
      isDividerShow={true}
      dividerColor="rgba(148,163,184,0.4)"
      isExpensesCTA={true}
      onViewExpenses={() => navigate("/expenses")}
    />
  );
};

const ExpensesPage = () => {
  const navigate = useNavigate();
  return (
    <ExpensesView
      onBack={() => navigate("/contributions")}
      backgroundColor="#020617"
      textColor="#e5e7eb"
      cardBackgroundColor="rgba(15,23,42,0.9)"
      dividerColor="rgba(148,163,184,0.4)"
    />
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
      <HashRouter>
        <div style={{ paddingBottom: "70px" }}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/contributions" element={<ContributionsPage />} />
            <Route path="/expenses" element={<ExpensesPage />} />
            <Route path="/video/:author/:permlink" element={<VideoDetail />} />
            <Route path="/user/:username" element={<UserProfile />} />
            {/* <Route path="/profile/:username" element={<UserDetailProfilePage />} /> */}
            <Route path="/composer" element={<PostComposerPage />} />
            {/* React Router v6+ only parses `:param` when preceded by `/`, so the `@`
                lives inside the param value. The page components strip a leading `@`. */}
            <Route path="/:author/:permlink" element={<HiveDetailPostPage />} />
            <Route path="/:username" element={<UserDetailProfilePage />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
        {/* <HiveToolbar /> */}
      </HashRouter>
  </QueryClientProvider>
);

export default App;
