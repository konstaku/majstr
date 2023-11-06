import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { MasterContextProvider } from './context';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <MasterContextProvider>
      <RouterProvider router={router} />
    </MasterContextProvider>
  </React.StrictMode>
);
