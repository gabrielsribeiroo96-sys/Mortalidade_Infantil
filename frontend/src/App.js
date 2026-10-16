import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AccessibilityProvider } from "@/context/AccessibilityContext";
import Dashboard from "@/pages/Dashboard";

function App() {
  return (
    <AccessibilityProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </AccessibilityProvider>
  );
}

export default App;
