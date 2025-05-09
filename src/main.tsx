
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { App, ErrorBoundary } from './App.tsx';
import './index.css';
import ConnectionSettings from '@/pages/ConnectionSettings';
import HojaDeRuta from '@/pages/HojaDeRuta';
import LaborPOForm from '@/pages/LaborPOForm';

// Define your routes
const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    errorElement: <ErrorBoundary />,
    children: [
      {
        path: '/connection-settings',
        element: <ConnectionSettings />,
      },
      {
        path: '/hoja-de-ruta',
        element: <HojaDeRuta />,
      },
      {
        path: '/labor-po-form',
        element: <LaborPOForm />,
      },
      // Add other routes here
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <RouterProvider router={router} />
);
