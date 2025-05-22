
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Create root once and render your app
const root = createRoot(document.getElementById("root")!);
root.render(<App />);
