import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import AboutPage from './pages/AboutPage';
import ZephyrPage from './pages/ZephyrPage';
import RainfallPage from './pages/RainfallPage';
import ContactPage from './pages/ContactPage';

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/products/zephyr" element={<ZephyrPage />} />
                <Route path="/products/rainfall" element={<RainfallPage />} />
                <Route path="/contact" element={<ContactPage />} />
                <Route path="*" element={<Navigate to="/" />} />
            </Routes>
        </BrowserRouter>
    );
}
