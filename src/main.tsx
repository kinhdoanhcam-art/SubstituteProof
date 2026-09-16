import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
// Transaction Kit ships its own stylesheet; without it the fee panel renders as
// unstyled run-together text.
import '@genlayer/transaction-kit-react/styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
