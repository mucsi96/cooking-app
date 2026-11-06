import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { initializeFaro } from '@grafana/faro-web-sdk';
import '@mucsi96/react-ui/styles.css';
import '@mucsi96/react-ui/typography.css';
import './styles.css';
import { App } from './App';

initializeFaro({
  url: new URL('/_telemetry/collect', window.location.origin).href,
  app: { name: 'cooking-client', version: '1.0.0' },
  consoleInstrumentation: { disabledLevels: [] },
});

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});
const root = document.getElementById('root');
if (!root) throw new Error('Missing application root');
createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter><App /></BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
