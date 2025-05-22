
import { createBrowserRouter } from "react-router-dom";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import { FestivalManagementWrapper } from "@/components/festival/FestivalManagementWrapper";
import Auth from "@/pages/Auth";
import { RequireAuth } from "@/components/RequireAuth";

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
        element: <RequireAuth><Dashboard /></RequireAuth> 
      },
      { 
        path: "/festival-management/:festivalId", 
        element: <RequireAuth><FestivalManagementWrapper /></RequireAuth> 
      },
      {
        path: "/jobs",
        element: <RequireAuth><Placeholder /></RequireAuth>,
      },
      {
        path: "/jobs/:jobId",
        element: <RequireAuth><Placeholder /></RequireAuth>,
      },
      {
        path: "/jobs/view/:jobId",
        element: <RequireAuth><Placeholder /></RequireAuth>,
      },
      {
        path: "/jobs/create",
        element: <RequireAuth><Placeholder /></RequireAuth>,
      },
      {
        path: "/jobs/edit/:jobId",
        element: <RequireAuth><Placeholder /></RequireAuth>,
      },
      {
        path: "/contacts",
        element: <RequireAuth><Placeholder /></RequireAuth>,
      },
      {
        path: "/contacts/:contactId",
        element: <RequireAuth><Placeholder /></RequireAuth>,
      },
      {
        path: "/contacts/create",
        element: <RequireAuth><Placeholder /></RequireAuth>,
      },
      {
        path: "/contacts/edit/:contactId",
        element: <RequireAuth><Placeholder /></RequireAuth>,
      },
      {
        path: "/locations",
        element: <RequireAuth><Placeholder /></RequireAuth>,
      },
      {
        path: "/locations/:locationId",
        element: <RequireAuth><Placeholder /></RequireAuth>,
      },
      {
        path: "/locations/create",
        element: <RequireAuth><Placeholder /></RequireAuth>,
      },
      {
        path: "/locations/edit/:locationId",
        element: <RequireAuth><Placeholder /></RequireAuth>,
      },
      {
        path: "/departments",
        element: <RequireAuth><Placeholder /></RequireAuth>,
      },
      {
        path: "/departments/:departmentId",
        element: <RequireAuth><Placeholder /></RequireAuth>,
      },
      {
        path: "/departments/create",
        element: <RequireAuth><Placeholder /></RequireAuth>,
      },
      {
        path: "/departments/edit/:departmentId",
        element: <RequireAuth><Placeholder /></RequireAuth>,
      },
      {
        path: "/documents",
        element: <RequireAuth><Placeholder /></RequireAuth>,
      },
      {
        path: "/settings",
        element: <RequireAuth><Placeholder /></RequireAuth>,
      },
      {
        path: "/users",
        element: <RequireAuth><Placeholder /></RequireAuth>,
      },
      {
        path: "/users/:userId",
        element: <RequireAuth><Placeholder /></RequireAuth>,
      },
      {
        path: "/users/create",
        element: <RequireAuth><Placeholder /></RequireAuth>,
      },
      {
        path: "/users/edit/:userId",
        element: <RequireAuth><Placeholder /></RequireAuth>,
      },
      {
        path: "/profile/view/:profileId",
        element: <RequireAuth><Placeholder /></RequireAuth>,
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
]);

export default router;
