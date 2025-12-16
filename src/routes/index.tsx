import { createBrowserRouter } from "react-router-dom";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import TechnicianDashboard from "@/pages/TechnicianDashboard";
import Personal from "@/pages/Personal";
import VacationManagement from "@/pages/VacationManagement";
import Tours from "@/pages/Tours";
import Landing from "@/pages/Landing";
import { FestivalManagementWrapper } from "@/components/festival/FestivalManagementWrapper";
import { TourManagementWrapper } from "@/components/tours/TourManagementWrapper";
import Auth from "@/pages/Auth";
import { RequireAuth } from "@/components/RequireAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import RatesCenterPage from "@/pages/RatesCenterPage";
import ExpensesPage from "@/pages/Expenses";
import SoundVisionFiles from "@/pages/SoundVisionFiles";

// Create a placeholder for missing pages
const Placeholder = () => (
  <div className="p-4">
    <h1 className="text-2xl font-bold mb-4">Page Under Construction</h1>
    <p className="text-muted-foreground">This page is currently being developed.</p>
  </div>
);

// Define our router with the updated imports
const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { 
        path: "/", 
        element: (
          <ProtectedRoute allowedRoles={['admin', 'management', 'logistics']}>
            <Dashboard />
          </ProtectedRoute>
        )
      },
      {
        path: "/dashboard",
        element: (
          <ProtectedRoute allowedRoles={['admin', 'management', 'logistics']}>
            <Dashboard />
          </ProtectedRoute>
        )
      },
      {
        path: "/technician-dashboard",
        element: (
          <ProtectedRoute allowedRoles={['technician', 'house_tech']}>
            <TechnicianDashboard />
          </ProtectedRoute>
        )
      },
      {
        path: "/personal",
        element: <Personal />
      },
      {
        path: "/tours",
        element: (
          <ProtectedRoute allowedRoles={['admin', 'management', 'house_tech']}>
            <Tours />
          </ProtectedRoute>
        )
      },
      { 
        path: "/festival-management/:festivalId", 
        element: (
          <ProtectedRoute allowedRoles={['admin', 'management', 'house_tech']}>
            <FestivalManagementWrapper />
          </ProtectedRoute>
        )
      },
      {
        path: "/tour-management/:tourId",
        element: (
          <ProtectedRoute allowedRoles={['admin', 'management', 'house_tech']}>
            <TourManagementWrapper />
          </ProtectedRoute>
        )
      },
      {
        path: "/vacation-management",
        element: (
          <ProtectedRoute allowedRoles={['admin', 'management']}>
            <VacationManagement />
          </ProtectedRoute>
        )
      },
      {
        path: "/management/rates",
        element: (
          <ProtectedRoute allowedRoles={['admin', 'management']}>
            <RatesCenterPage />
          </ProtectedRoute>
        )
      },
      {
        path: "/gastos",
        element: (
          <ProtectedRoute allowedRoles={['admin', 'management', 'logistics']}>
            <ExpensesPage />
          </ProtectedRoute>
        )
      },
      {
        path: "/jobs",
        element: <Placeholder />,
      },
      {
        path: "/jobs/:jobId",
        element: <Placeholder />,
      },
      {
        path: "/jobs/view/:jobId",
        element: <Placeholder />,
      },
      {
        path: "/jobs/create",
        element: <Placeholder />,
      },
      {
        path: "/jobs/edit/:jobId",
        element: <Placeholder />,
      },
      {
        path: "/contacts",
        element: <Placeholder />,
      },
      {
        path: "/contacts/:contactId",
        element: <Placeholder />,
      },
      {
        path: "/contacts/create",
        element: <Placeholder />,
      },
      {
        path: "/contacts/edit/:contactId",
        element: <Placeholder />,
      },
      {
        path: "/locations",
        element: <Placeholder />,
      },
      {
        path: "/locations/:locationId",
        element: <Placeholder />,
      },
      {
        path: "/locations/create",
        element: <Placeholder />,
      },
      {
        path: "/locations/edit/:locationId",
        element: <Placeholder />,
      },
      {
        path: "/departments",
        element: <Placeholder />,
      },
      {
        path: "/departments/:departmentId",
        element: <Placeholder />,
      },
      {
        path: "/departments/create",
        element: <Placeholder />,
      },
      {
        path: "/departments/edit/:departmentId",
        element: <Placeholder />,
      },
      {
        path: "/documents",
        element: <Placeholder />,
      },
      {
        path: "/settings",
        element: (
          <ProtectedRoute allowedRoles={['admin', 'management']}>
            <Placeholder />
          </ProtectedRoute>
        )
      },
      {
        path: "/soundvision-files",
        element: (
          <ProtectedRoute allowedRoles={['admin', 'management', 'logistics']}>
            <SoundVisionFiles />
          </ProtectedRoute>
        )
      },
      {
        path: "/users",
        element: <Placeholder />,
      },
      {
        path: "/users/:userId",
        element: <Placeholder />,
      },
      {
        path: "/users/create",
        element: <Placeholder />,
      },
      {
        path: "/users/edit/:userId",
        element: <Placeholder />,
      },
      {
        path: "/profile/view/:profileId",
        element: <Placeholder />,
      },
    ],
  },
  {
    path: "/auth",
    element: <Auth />,
  },
  {
    path: "/create-profile",
    element: <Placeholder />,
  },
  {
    path: "/landing",
    element: <Landing />,
  },
]);

export default router;
