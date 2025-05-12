
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Just render the App component, all providers are already inside App.tsx
createRoot(document.getElementById("root")!).render(<App />);
