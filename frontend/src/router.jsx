import { Outlet, createBrowserRouter } from 'react-router-dom';
import MainSearch from './pages/MainSearch';
import AddNewRecord from './pages/AddNewRecord';
import Root from './components/Root';
import Login from './pages/Login';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Root />,
    children: [
      {
        index: true,
        element: <MainSearch />,
      },
      {
        path: '/add',
        element: <AddNewRecord />,
      },
      {
        path: '/login',
        element: <Login />,
      },
    ],
  },
]);
