
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Create root once and render your app
const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<App />);
} else {
  console.error("Could not find root element");
}
