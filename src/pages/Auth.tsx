import { useState, useEffect, useRef, useCallback } from "react";
import { Navigate, useSearchParams, useNavigate } from "react-router-dom";
import { SignUpForm } from "@/components/auth/SignUpForm";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { getDashboardPath } from "@/utils/roleBasedRouting";
import { UserRole } from "@/types/user";
import { Mail, Lock, ChevronRight, Loader2 } from "lucide-react";

// Brand configuration - easily customizable for sectorprologow variant
const BRAND_CONFIG = {
  name: "Sector Pro",
  tagline: "Área Técnica",
  logo: "/lovable-uploads/ce3ff31a-4cc5-43c8-b5bb-a4056d3735e4.png",
  colors: {
    primary: "#3b82f6",
    accent: "#8b5cf6",
    blob1: "rgba(59, 130, 246, 0.5)",
    blob2: "rgba(139, 92, 246, 0.4)",
    blob3: "rgba(6, 182, 212, 0.3)",
  }
};

const Auth = () => {
  const { session, userRole, isLoading, error: authError, login } = useOptimizedAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showSignUp, setShowSignUp] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const isRecovery = searchParams.get('type') === 'recovery';

  // Track latest userRole in a ref to avoid stale closures in triggerTransition
  const latestRoleRef = useRef<UserRole | null>(userRole as UserRole | null);

  useEffect(() => {
    latestRoleRef.current = userRole as UserRole | null;
  }, [userRole]);

  // Form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Swipe state
  const [swipeX, setSwipeX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);

  // Handle successful login transition - uses ref to get latest role
  const triggerTransition = useCallback(() => {
    setIsTransitioning(true);
    setTimeout(() => {
      const dashboardPath = getDashboardPath(latestRoleRef.current);
      navigate(dashboardPath, { replace: true });
    }, 800);
  }, [navigate]);

  // Handle login
  const handleLogin = async () => {
    if (!email || !password) {
      setFormError("Por favor, introduce tu email y contraseña");
      return false;
    }

    setFormError(null);
    setIsSubmitting(true);

    try {
      await login(email, password);
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al iniciar sesión";
      setFormError(message);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  // Swipe handlers
  const handleDragStart = (clientX: number) => {
    if (isSubmitting) return;
    setIsDragging(true);
    startXRef.current = clientX - swipeX;
  };

  const handleDragMove = (clientX: number) => {
    if (!isDragging || !trackRef.current) return;
    const trackWidth = trackRef.current.offsetWidth;
    const handleWidth = 56;
    const maxX = trackWidth - handleWidth - 8;
    const newX = Math.max(0, Math.min(clientX - startXRef.current, maxX));
    setSwipeX(newX);
  };

  const handleDragEnd = async () => {
    if (!isDragging || !trackRef.current) return;
    setIsDragging(false);

    const trackWidth = trackRef.current.offsetWidth;
    const handleWidth = 56;
    const maxX = trackWidth - handleWidth - 8;
    const threshold = maxX * 0.8;

    if (swipeX >= threshold) {
      setSwipeX(maxX);
      const success = await handleLogin();
      if (success) {
        // Will be handled by session change
      } else {
        setSwipeX(0);
      }
    } else {
      setSwipeX(0);
    }
  };

  // Mouse events
  const onMouseDown = (e: React.MouseEvent) => handleDragStart(e.clientX);
  const onMouseMove = (e: React.MouseEvent) => handleDragMove(e.clientX);
  const onMouseUp = () => handleDragEnd();
  const onMouseLeave = () => {
    if (isDragging) {
      setIsDragging(false);
      setSwipeX(0);
    }
  };

  // Touch events
  const onTouchStart = (e: React.TouchEvent) => handleDragStart(e.touches[0].clientX);
  const onTouchMove = (e: React.TouchEvent) => handleDragMove(e.touches[0].clientX);
  const onTouchEnd = () => handleDragEnd();

  // Form submit handler
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await handleLogin();
    if (success) {
      triggerTransition();
    }
  };

  // Trigger transition when session becomes available AND role is loaded
  useEffect(() => {
    if (session && !isRecovery && !isTransitioning && userRole) {
      triggerTransition();
    }
  }, [session, isRecovery, isTransitioning, userRole, triggerTransition]);

  // Already logged in - immediate redirect (wait for role to be loaded)
  if (session && !isRecovery && !isTransitioning && userRole) {
    const dashboardPath = getDashboardPath(latestRoleRef.current);
    return <Navigate to={dashboardPath} replace />;
  }

  // Show legacy forms for signup/recovery
  if (showSignUp || showForgotPassword || isRecovery) {
    return (
      <div className="min-h-screen flex flex-col px-4 py-8 md:py-12 bg-slate-50">
        <div className="container max-w-lg mx-auto flex-1 flex flex-col">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-2 text-slate-900">Bienvenido</h1>
            <p className="text-lg text-slate-500">al Área Técnica Sector-Pro</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200">
            {isRecovery ? (
              <ResetPasswordForm onSuccess={() => { }} />
            ) : showForgotPassword ? (
              <ForgotPasswordForm onBack={() => setShowForgotPassword(false)} />
            ) : (
              <SignUpForm onBack={() => setShowSignUp(false)} />
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen w-full overflow-hidden relative transition-opacity duration-700 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}
      onMouseMove={isDragging ? onMouseMove : undefined}
      onMouseUp={isDragging ? onMouseUp : undefined}
      onMouseLeave={onMouseLeave}
    >
      {/* Ambient mesh background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        {/* Animated blobs */}
        <div
          className="absolute w-96 h-96 rounded-full blur-3xl animate-pulse"
          style={{
            background: BRAND_CONFIG.colors.blob1,
            top: '10%',
            left: '20%',
            animation: 'pulse 8s ease-in-out infinite, float1 20s ease-in-out infinite',
          }}
        />
        <div
          className="absolute w-80 h-80 rounded-full blur-3xl"
          style={{
            background: BRAND_CONFIG.colors.blob2,
            top: '50%',
            right: '10%',
            animation: 'pulse 10s ease-in-out infinite 2s, float2 25s ease-in-out infinite',
          }}
        />
        <div
          className="absolute w-72 h-72 rounded-full blur-3xl"
          style={{
            background: BRAND_CONFIG.colors.blob3,
            bottom: '10%',
            left: '30%',
            animation: 'pulse 12s ease-in-out infinite 4s, float3 22s ease-in-out infinite',
          }}
        />

        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
          }}
        />
      </div>

      {/* Main content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          {/* Logo and branding */}
          <div className="text-center mb-8">
            <img
              src={BRAND_CONFIG.logo}
              alt={BRAND_CONFIG.name}
              className="h-16 w-auto mx-auto mb-4 drop-shadow-2xl"
            />
            <h1 className="text-3xl font-bold text-white mb-1">
              Bienvenido
            </h1>
            <p className="text-slate-400 text-sm">
              {BRAND_CONFIG.tagline}
            </p>
          </div>

          {/* Glass panel */}
          <div
            className="relative rounded-2xl p-6 border border-white/10"
            style={{
              background: 'rgba(15, 23, 42, 0.7)',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
            }}
          >
            <form onSubmit={handleFormSubmit} className="space-y-5">
              {/* Error message */}
              {(formError || authError) && (
                <div className="bg-red-500/20 border border-red-500/30 rounded-lg px-4 py-3 text-red-200 text-sm">
                  {formError || authError}
                </div>
              )}

              {/* Email input */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                    placeholder="tu@email.com"
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Password input */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">
                  Contraseña
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                </div>
              </div>

              {/* Swipe to access */}
              <div className="pt-2">
                <div
                  ref={trackRef}
                  className="relative h-14 rounded-full overflow-hidden cursor-pointer select-none"
                  style={{
                    background: 'linear-gradient(90deg, rgba(59,130,246,0.15) 0%, rgba(139,92,246,0.15) 100%)',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                  onTouchStart={onTouchStart}
                  onTouchMove={onTouchMove}
                  onTouchEnd={onTouchEnd}
                >
                  {/* Shimmer effect */}
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)',
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 2s ease-in-out infinite',
                    }}
                  />

                  {/* Progress fill */}
                  <div
                    className="absolute inset-0 rounded-full pointer-events-none transition-opacity"
                    style={{
                      background: 'linear-gradient(90deg, rgba(59,130,246,0.3) 0%, rgba(139,92,246,0.4) 100%)',
                      opacity: swipeX > 0 ? Math.min(swipeX / 200, 0.8) : 0,
                    }}
                  />

                  {/* Track label */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span
                      className="text-slate-400 text-sm font-medium tracking-wide transition-opacity"
                      style={{ opacity: isSubmitting ? 1 : Math.max(0.3, 1 - swipeX / 150) }}
                    >
                      {isSubmitting ? 'Iniciando sesión...' : 'Desliza para acceder'}
                    </span>
                    {/* Chevrons hint */}
                    {!isSubmitting && swipeX < 20 && (
                      <div className="absolute right-4 flex gap-0.5 opacity-40">
                        <ChevronRight className="w-4 h-4 text-slate-400 animate-pulse" style={{ animationDelay: '0ms' }} />
                        <ChevronRight className="w-4 h-4 text-slate-400 animate-pulse" style={{ animationDelay: '150ms' }} />
                      </div>
                    )}
                  </div>

                  {/* Draggable handle */}
                  <div
                    className="absolute top-1 left-1 w-12 h-12 rounded-full flex items-center justify-center touch-none"
                    style={{
                      transform: `translateX(${swipeX}px) scale(${isDragging ? 1.05 : 1})`,
                      transition: isDragging ? 'none' : 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                      background: isSubmitting
                        ? 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)'
                        : 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                      boxShadow: isDragging
                        ? '0 8px 25px rgba(59,130,246,0.5), 0 0 0 4px rgba(59,130,246,0.2)'
                        : '0 4px 15px rgba(59,130,246,0.4)',
                    }}
                    onMouseDown={onMouseDown}
                    onTouchStart={onTouchStart}
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                    ) : (
                      <ChevronRight
                        className="w-5 h-5 text-white transition-transform"
                        style={{ transform: `translateX(${isDragging ? 2 : 0}px)` }}
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Alternative: submit button for keyboard users */}
              <button type="submit" className="sr-only">
                Iniciar sesión
              </button>

              {/* Divider */}
              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-700" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2 text-slate-500 bg-slate-900/50">o continúa con</span>
                </div>
              </div>

              {/* OAuth buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  className="flex items-center justify-center gap-2 py-3 px-4 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 rounded-xl text-white text-sm font-medium transition-all"
                  onClick={() => alert('Próximamente: Inicio de sesión con Google')}
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Google
                </button>
                <button
                  type="button"
                  className="flex items-center justify-center gap-2 py-3 px-4 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 rounded-xl text-white text-sm font-medium transition-all"
                  onClick={() => alert('Próximamente: Inicio de sesión con Apple')}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                  </svg>
                  Apple
                </button>
              </div>

              {/* Links */}
              <div className="flex items-center justify-center pt-2 text-sm">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            </form>
          </div>

          {/* Footer */}
          <p className="text-center text-slate-500 text-xs mt-6">
            © {new Date().getFullYear()} {BRAND_CONFIG.name}. Todos los derechos reservados.
          </p>
        </div>
      </div>

      {/* Transition overlay */}
      {isTransitioning && (
        <div
          className="fixed inset-0 z-50 bg-slate-900 flex items-center justify-center"
          style={{
            animation: 'fadeIn 0.5s ease-out forwards',
          }}
        >
          <div className="text-center">
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto mb-4" />
            <p className="text-slate-400">Cargando tu espacio de trabajo...</p>
          </div>
        </div>
      )}

      {/* Keyframe animations */}
      <style>{`
        @keyframes float1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -30px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        @keyframes float2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-40px, 30px) scale(1.05); }
          66% { transform: translate(30px, -20px) scale(0.95); }
        }
        @keyframes float3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(20px, 20px) scale(1.08); }
          66% { transform: translate(-30px, -30px) scale(0.92); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {/* Loading state */}
      {isLoading && (
        <div className="fixed inset-0 z-50 bg-slate-900 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      )}
    </div>
  );
};

export default Auth;
