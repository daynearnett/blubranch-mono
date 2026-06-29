import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth";
import ErrorBoundary from "@/components/layout/error-boundary";
import AppShell from "@/components/layout/app-shell";

const LoginPage = lazy(() => import("./pages/login"));
const DashboardPage = lazy(() => import("./pages/dashboard"));
const WorkersPage = lazy(() => import("./pages/workers"));
const EmployersPage = lazy(() => import("./pages/employers"));
const JobsPage = lazy(() => import("./pages/jobs"));
const ApplicationsPage = lazy(() => import("./pages/applications"));
const PostsPage = lazy(() => import("./pages/posts"));
const LicensesPage = lazy(() => import("./pages/licenses"));
const WorkplacesPage = lazy(() => import("./pages/workplaces"));
const TradesPage = lazy(() => import("./pages/trades"));
const SkillsPage = lazy(() => import("./pages/skills"));
const ReportsPage = lazy(() => import("./pages/reports"));
const IssuesPage = lazy(() => import("./pages/issues"));

function PageLoader() {
  return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary" />
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route
                path="/login"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <LoginPage />
                  </Suspense>
                }
              />

              <Route path="/" element={<AppShell />}>
                <Route
                  index
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <DashboardPage />
                    </Suspense>
                  }
                />
                <Route
                  path="workers"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <WorkersPage />
                    </Suspense>
                  }
                />
                <Route
                  path="employers"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <EmployersPage />
                    </Suspense>
                  }
                />
                <Route
                  path="jobs"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <JobsPage />
                    </Suspense>
                  }
                />
                <Route
                  path="applications"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ApplicationsPage />
                    </Suspense>
                  }
                />
                <Route
                  path="posts"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PostsPage />
                    </Suspense>
                  }
                />
                <Route
                  path="licenses"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <LicensesPage />
                    </Suspense>
                  }
                />
                <Route
                  path="workplaces"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <WorkplacesPage />
                    </Suspense>
                  }
                />
                <Route
                  path="trades"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <TradesPage />
                    </Suspense>
                  }
                />
                <Route
                  path="skills"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <SkillsPage />
                    </Suspense>
                  }
                />
                <Route
                  path="reports"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ReportsPage />
                    </Suspense>
                  }
                />
                <Route
                  path="issues"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <IssuesPage />
                    </Suspense>
                  }
                />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <Toaster />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
