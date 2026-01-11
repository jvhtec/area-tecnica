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
      <div className="auth-no-oauth min-h-screen flex flex-col px-4 py-8 md:py-12 bg-slate-50">
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
      className={`auth-no-oauth min-h-screen w-full overflow-hidden relative transition-opacity duration-700 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}
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
            {/* eslint-disable-next-line react/no-unknown-property */}
            <img
              src={BRAND_CONFIG.logo}
              alt={BRAND_CONFIG.name}
              width={794}
              height={100}
              loading="eager"
              decoding="async"
              // @ts-expect-error fetchpriority is valid HTML but React types don't include it yet
              fetchpriority="high"
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
          <div className="text-center text-slate-500 text-xs mt-6 space-y-2">
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-300 transition-colors"
            >
              Politica de Privacidad
            </a>
            <p>
              © {new Date().getFullYear()} {BRAND_CONFIG.name}. Todos los derechos reservados.
            </p>
          </div>
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
