import { createBrowserRouter } from 'react-router-dom';
import AddNewRecord from './pages/AddNewRecord';

import Main from './pages/Main';
import Root from './components/Root';
import Login from './pages/Login';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Root />,
    children: [
      {
        index: true,
        element: <Main />,
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
