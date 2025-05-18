import { createBrowserRouter } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Dashboard } from "@/pages/Dashboard";
import { FestivalManagementWrapper } from "@/components/festival/FestivalManagementWrapper";
import { Auth } from "@/pages/Auth";
import { CreateProfile } from "@/pages/CreateProfile";
import { RequireAuth } from "@/components/RequireAuth";
import { Jobs } from "@/pages/Jobs";
import { JobDetails } from "@/pages/JobDetails";
import { CreateJob } from "@/pages/CreateJob";
import { EditJob } from "@/pages/EditJob";
import { ViewOnlyJobDetails } from "@/pages/ViewOnlyJobDetails";
import { Contacts } from "@/pages/Contacts";
import { ContactDetails } from "@/pages/ContactDetails";
import { CreateContact } from "@/pages/CreateContact";
import { EditContact } from "@/pages/EditContact";
import { Locations } from "@/pages/Locations";
import { LocationDetails } from "@/pages/LocationDetails";
import { CreateLocation } from "@/pages/CreateLocation";
import { EditLocation } from "@/pages/EditLocation";
import { Departments } from "@/pages/Departments";
import { DepartmentDetails } from "@/pages/DepartmentDetails";
import { CreateDepartment } from "@/pages/CreateDepartment";
import { EditDepartment } from "@/pages/EditDepartment";
import { Documents } from "@/pages/Documents";
import { Settings } from "@/pages/Settings";
import { Users } from "@/pages/Users";
import { UserDetails } from "@/pages/UserDetails";
import { CreateUser } from "@/pages/CreateUser";
import { EditUser } from "@/pages/EditUser";
import { ViewOnlyProfile } from "@/pages/ViewOnlyProfile";

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
        element: <Jobs />,
      },
      {
        path: "/jobs/:jobId",
        element: <JobDetails />,
      },
      {
        path: "/jobs/view/:jobId",
        element: <ViewOnlyJobDetails />,
      },
      {
        path: "/jobs/create",
        element: <CreateJob />,
      },
      {
        path: "/jobs/edit/:jobId",
        element: <EditJob />,
      },
      {
        path: "/contacts",
        element: <Contacts />,
      },
      {
        path: "/contacts/:contactId",
        element: <ContactDetails />,
      },
      {
        path: "/contacts/create",
        element: <CreateContact />,
      },
      {
        path: "/contacts/edit/:contactId",
        element: <EditContact />,
      },
      {
        path: "/locations",
        element: <Locations />,
      },
      {
        path: "/locations/:locationId",
        element: <LocationDetails />,
      },
      {
        path: "/locations/create",
        element: <CreateLocation />,
      },
      {
        path: "/locations/edit/:locationId",
        element: <EditLocation />,
      },
      {
        path: "/departments",
        element: <Departments />,
      },
      {
        path: "/departments/:departmentId",
        element: <DepartmentDetails />,
      },
      {
        path: "/departments/create",
        element: <CreateDepartment />,
      },
      {
        path: "/departments/edit/:departmentId",
        element: <EditDepartment />,
      },
      {
        path: "/documents",
        element: <Documents />,
      },
      {
        path: "/settings",
        element: <Settings />,
      },
      {
        path: "/users",
        element: <Users />,
      },
      {
        path: "/users/:userId",
        element: <UserDetails />,
      },
      {
        path: "/users/create",
        element: <CreateUser />,
      },
      {
        path: "/users/edit/:userId",
        element: <EditUser />,
      },
      {
        path: "/profile/view/:profileId",
        element: <ViewOnlyProfile />,
      },
    ],
  },
  {
    path: "/auth",
    element: <Auth />,
  },
  {
    path: "/create-profile",
    element: (
      <RequireAuth>
        <CreateProfile />
      </RequireAuth>
    ),
  },
]);

export default router;
