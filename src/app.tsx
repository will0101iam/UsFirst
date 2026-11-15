import HomePage from '@/pages/HomePage/HomePage';
import NotFoundPage from '@/pages/NotFoundPage/NotFoundPage';
export default function App() {
  const path = window.location.pathname;
  return path === '/' || path === '/index.html' ? <HomePage/> : <NotFoundPage/>;
}
