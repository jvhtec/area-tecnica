import { ConnectionMonitor } from './connection-monitor';

export function Header() {
  return (
    <header className="border-b">
      <div className="flex h-16 items-center px-4 gap-4 justify-between">
        <div className="flex items-center">
          <a href="/" className="flex items-center">
            <img src="/logo.svg" alt="Sector Pro Logo" className="h-8 w-8 mr-2" />
            <span className="font-bold text-xl">Sector Pro</span>
          </a>
        </div>
        
        <div className="ml-auto flex items-center space-x-4">
          <ConnectionMonitor size="sm" showLabel={false} />
          <div className="flex items-center gap-2">
            <button className="text-sm font-medium">
              Profile
            </button>
            <button className="text-sm font-medium">
              Settings
            </button>
            <button className="text-sm font-medium">
              Logout
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
