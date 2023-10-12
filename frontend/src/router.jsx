import { createBrowserRouter } from 'react-router-dom';
import MainSearch from './pages/MainSearch';
import AddNewRecord from './pages/AddNewRecord';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <MainSearch />,
  },
  {
    path: '/add',
    element: <AddNewRecord />,
  },
]);
