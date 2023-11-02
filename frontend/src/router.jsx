import { createBrowserRouter } from 'react-router-dom';
import MainSearch from './pages/MainSearch';
import AddNewRecord from './pages/AddNewRecord';
import Root from './components/Root';

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
    ],
  },

  {
    path: '/login',
    action: () => alert('LOGIN'),
  },
]);
