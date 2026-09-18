import backgroundVideo from '../assets/videos/19660176-hd_1920_1080_24fps.mp4';
import Sidebar from './Sidebar';

export default function Layout({ children }) {
  return (
    <div className="relative flex h-screen overflow-hidden bg-bg text-text font-sans">

      {/* Background Video */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="pointer-events-none fixed inset-0 z-0 h-full w-full object-cover"
        src={backgroundVideo}
      />

      {/* Dark Overlay */}
      <div className="fixed inset-0 z-10 bg-bg/60" />

      {/* App Content */}
      <div className="relative z-20 flex h-full w-full">
        <Sidebar />

        <main className="h-screen flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

    </div>
  );
}