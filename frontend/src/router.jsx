import { createBrowserRouter } from 'react-router-dom';
import AddNewRecord from './pages/AddNewRecord';

// import Main from './pages/Main';
import { mainRoute } from './pages/Main';
import Root from './components/Root';
import Login from './pages/Login';
import Profile from './pages/Profile';
import ErrorPage from './pages/ErrorPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Root />,
    children: [
      {
        errorElement: <ErrorPage />,
        children: [
          {
            index: true,
            ...mainRoute,
          },
          {
            path: '/add',
            element: <AddNewRecord />,
          },
          {
            path: '/login',
            element: <Login />,
          },
          {
            path: '/profile',
            element: <Profile />,
          },
        ],
      },
    ],
  },
]);
