
import { createBrowserRouter } from "react-router-dom";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import { FestivalManagementWrapper } from "@/components/festival/FestivalManagementWrapper";
import Auth from "@/pages/Auth";

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
        element: <Dashboard /> 
      },
      { 
        path: "/festival-management/:festivalId", 
        element: <FestivalManagementWrapper /> 
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
        element: <Placeholder />,
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
]);

export default router;
