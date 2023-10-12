import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { PigletsContextProvider } from './context';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PigletsContextProvider>
      <RouterProvider router={router} />
    </PigletsContextProvider>
  </React.StrictMode>
);
