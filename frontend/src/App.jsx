import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import History from './pages/History';
import { AppDialogProvider } from './components/AppDialog';

export default function App() {
  return (
    <AppDialogProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/history" element={<History />} />
        </Routes>
      </Router>
    </AppDialogProvider>
  );
}
