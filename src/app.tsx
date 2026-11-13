import { Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import HomePage from '@/pages/HomePage/HomePage';
import NotFoundPage from '@/pages/NotFoundPage/NotFoundPage';
import DesignsPage from '@/pages/DesignsPage/DesignsPage';
import FocusVariationsPage from '@/pages/DesignsPage/FocusVariationsPage';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="designs" element={<DesignsPage />} />
        <Route path="designs/focus" element={<FocusVariationsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
