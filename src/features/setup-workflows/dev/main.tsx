import { createRoot } from 'react-dom/client';
import '@/index.css';
import { WorkflowDemo } from './demo';

// Standalone Vite development entry: not a production route/build input.
if (import.meta.env.DEV) createRoot(document.getElementById('root')!).render(<WorkflowDemo />);
