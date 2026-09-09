import Sidebar from './Sidebar';

export default function Layout({ children }) {
  return (
    <div className="flex bg-bg text-text font-sans">
      <Sidebar />
      <main className="flex-1 h-screen overflow-y-auto">
        {children}
      </main>
    </div>
  );
}