import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
import { App } from './App';
import { openLastSchema } from './store/startup';

// The stored schema is loaded before the first render, so the sample never flashes in its place.
void openLastSchema().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
