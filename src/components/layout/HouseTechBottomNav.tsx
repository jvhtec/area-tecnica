import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Briefcase, 
  Calendar as CalendarIcon, 
  User, 
  Menu,
  Speaker,
  Lightbulb,
  Camera,
  MapPin as MapIcon,
  Navigation,
  Users,
  X
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';

interface HouseTechBottomNavProps {
  className?: string;
}

const getThemeStyles = (isDark: boolean) => ({
  nav: isDark ? "bg-[#0f1219] border-t border-[#1f232e]" : "bg-white border-t border-slate-200",
  card: isDark ? "bg-[#0f1219] border-[#1f232e]" : "bg-white border-slate-200 shadow-sm",
  textMain: isDark ? "text-white" : "text-slate-900",
  textMuted: isDark ? "text-[#94a3b8]" : "text-slate-500",
});

export const HouseTechBottomNav: React.FC<HouseTechBottomNavProps> = ({ className = '' }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme: nextTheme } = useTheme();
  const { userDepartment } = useOptimizedAuth();
  const [showMenu, setShowMenu] = useState(false);

  const isDark = nextTheme === 'dark' || (
    nextTheme === 'system' &&
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  const t = getThemeStyles(isDark);

  // All possible routes for house techs
  const allHouseTechRoutes = [
    { path: '/personal', label: 'Personal', icon: CalendarIcon, department: null },
    { path: '/sound', label: 'Sonido', icon: Speaker, department: 'sound' },
    { path: '/lights', label: 'Luces', icon: Lightbulb, department: 'lights' },
    { path: '/video', label: 'Video', icon: Camera, department: 'video' },
    { path: '/logistics', label: 'Logística', icon: MapIcon, department: null },
    { path: '/tours', label: 'Tours', icon: Navigation, department: null },
    { path: '/festivals', label: 'Festivales', icon: Users, department: 'sound' },
  ];

  // Filter routes based on user's department
  const houseTechRoutes = useMemo(() => {
    const normalizedDept = userDepartment?.toLowerCase();
    
    return allHouseTechRoutes.filter(route => {
      // Routes without a department restriction are available to all
      if (route.department === null) {
        return true;
      }
      // Otherwise, only show if it matches the user's department
      return route.department === normalizedDept;
    });
  }, [userDepartment]);

  const isActive = (path: string) => {
    if (path === '/tech-app') {
      return location.pathname === '/tech-app';
    }
    return location.pathname.startsWith(path);
  };

  const mainNavItems = [
    { id: 'dashboard', path: '/tech-app', icon: LayoutDashboard, label: 'Panel' },
    { id: 'jobs', path: '/tech-app', icon: Briefcase, label: 'Trabajos' },
    { id: 'availability', path: '/tech-app', icon: CalendarIcon, label: 'Disponib.' },
    { id: 'profile', path: '/tech-app', icon: User, label: 'Perfil' },
    { id: 'menu', path: '#menu', icon: Menu, label: 'Menú' }
  ];

  const handleNavClick = (item: typeof mainNavItems[0]) => {
    if (item.id === 'menu') {
      setShowMenu(true);
    } else {
      navigate(item.path);
    }
  };

  return (
    <>
      <div className={`h-20 ${t.nav} fixed bottom-0 left-0 right-0 grid grid-cols-5 px-2 z-40 pb-4 ${className}`}>
        {mainNavItems.map(item => (
          <button
            key={item.id}
            onClick={() => handleNavClick(item)}
            className={`flex flex-col items-center justify-center gap-1 ${
              isActive(item.path) ? 'text-blue-500' : isDark ? 'text-gray-500' : 'text-slate-400'
            }`}
          >
            <item.icon size={22} strokeWidth={isActive(item.path) ? 2.5 : 2} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
      </div>

      {/* Menu Sheet */}
      <Sheet open={showMenu} onOpenChange={setShowMenu}>
        <SheetContent side="bottom" className="h-[80vh]">
          <SheetHeader>
            <SheetTitle>Menú de navegación</SheetTitle>
          </SheetHeader>
          <div className="mt-6 grid grid-cols-2 gap-3">
            {houseTechRoutes.map((route) => (
              <button
                key={route.path}
                onClick={() => {
                  navigate(route.path);
                  setShowMenu(false);
                }}
                className={`${t.card} border rounded-xl p-4 flex flex-col items-center gap-3 hover:border-blue-500 transition-all active:scale-95`}
              >
                <div className="p-3 rounded-full bg-blue-500/10">
                  <route.icon size={24} className="text-blue-500" />
                </div>
                <span className={`text-sm font-medium ${t.textMain}`}>{route.label}</span>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};
