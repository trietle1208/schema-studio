import { AppShell } from './components/AppShell';
import { Sidebar } from './components/Sidebar';

export function App() {
  return <AppShell sidebar={<Sidebar empty />} />;
}
