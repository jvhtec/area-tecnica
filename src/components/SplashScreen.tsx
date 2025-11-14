import React, { useEffect, useState } from 'react';

interface SplashScreenProps {
  onComplete?: () => void;
  duration?: number;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete, duration = 8000 }) => {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Create floating particles
    const particlesContainer = document.getElementById('splash-particles');
    if (particlesContainer) {
      const particleCount = 30;

      for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'splash-particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 10 + 's';
        particle.style.animationDuration = (Math.random() * 10 + 10) + 's';
        particlesContainer.appendChild(particle);
      }
    }

    // Auto-hide splash after specified duration
    const timer = setTimeout(() => {
      setFadeOut(true);

      setTimeout(() => {
        onComplete?.();
      }, 800);
    }, duration);

    return () => {
      clearTimeout(timer);
      if (particlesContainer) {
        particlesContainer.innerHTML = '';
      }
    };
  }, [duration, onComplete]);

  const handleClick = () => {
    setFadeOut(true);
    setTimeout(() => {
      onComplete?.();
    }, 800);
  };

  return (
    <>
      <style>{`
        .splash-container {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #0a0a0a 100%);
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          z-index: 9999;
          animation: splashFadeIn 0.5s ease-in;
          cursor: pointer;
        }

        .splash-container.fade-out {
          animation: splashFadeOut 0.8s ease-out forwards;
        }

        .splash-logo-container {
          position: relative;
          animation: splashLogoEntrance 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          opacity: 0;
        }

        .splash-logo {
          width: 600px;
          max-width: 80vw;
          height: auto;
          filter: drop-shadow(0 0 30px rgba(255, 255, 255, 0.3));
          animation: splashPulse 2s ease-in-out infinite;
        }

        .splash-glow-effect {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 120%;
          height: 120%;
          background: radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, transparent 70%);
          animation: splashGlowPulse 3s ease-in-out infinite;
          pointer-events: none;
        }

        .splash-loading-text {
          margin-top: 40px;
          color: #ffffff;
          font-size: 18px;
          font-weight: 300;
          letter-spacing: 4px;
          text-transform: uppercase;
          opacity: 0;
          animation: splashTextFade 1s ease-in 0.8s forwards;
        }

        .splash-loading-bar-container {
          margin-top: 30px;
          width: 300px;
          height: 2px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 2px;
          overflow: hidden;
          opacity: 0;
          animation: splashTextFade 1s ease-in 1s forwards;
        }

        .splash-loading-bar {
          height: 100%;
          background: linear-gradient(90deg, transparent, #ffffff, transparent);
          background-size: 200% 100%;
          animation: splashLoadingBar 1.5s ease-in-out infinite;
        }

        .splash-grid-background {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
          background-size: 50px 50px;
          animation: splashGridMove 20s linear infinite;
          pointer-events: none;
        }

        .splash-particles {
          position: absolute;
          width: 100%;
          height: 100%;
          overflow: hidden;
        }

        .splash-particle {
          position: absolute;
          width: 2px;
          height: 2px;
          background: rgba(255, 255, 255, 0.5);
          border-radius: 50%;
          animation: splashParticleFloat 10s linear infinite;
        }

        @keyframes splashFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes splashFadeOut {
          to {
            opacity: 0;
            visibility: hidden;
          }
        }

        @keyframes splashLogoEntrance {
          0% {
            opacity: 0;
            transform: scale(0.5) translateY(50px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        @keyframes splashPulse {
          0%, 100% {
            filter: drop-shadow(0 0 30px rgba(255, 255, 255, 0.3));
          }
          50% {
            filter: drop-shadow(0 0 50px rgba(255, 255, 255, 0.5));
          }
        }

        @keyframes splashGlowPulse {
          0%, 100% {
            opacity: 0.3;
            transform: translate(-50%, -50%) scale(1);
          }
          50% {
            opacity: 0.6;
            transform: translate(-50%, -50%) scale(1.1);
          }
        }

        @keyframes splashTextFade {
          to {
            opacity: 1;
          }
        }

        @keyframes splashLoadingBar {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }

        @keyframes splashGridMove {
          0% {
            transform: translate(0, 0);
          }
          100% {
            transform: translate(50px, 50px);
          }
        }

        @keyframes splashParticleFloat {
          0% {
            transform: translateY(100vh) translateX(0);
            opacity: 0;
          }
          10% {
            opacity: 0.5;
          }
          90% {
            opacity: 0.5;
          }
          100% {
            transform: translateY(-100vh) translateX(100px);
            opacity: 0;
          }
        }

        @media (max-width: 768px) {
          .splash-logo {
            width: 90vw;
          }

          .splash-loading-text {
            font-size: 14px;
            letter-spacing: 2px;
          }

          .splash-loading-bar-container {
            width: 200px;
          }
        }
      `}</style>

      <div
        className={`splash-container ${fadeOut ? 'fade-out' : ''}`}
        onClick={handleClick}
      >
        <div className="splash-grid-background" />
        <div className="splash-particles" id="splash-particles" />

        <div className="splash-logo-container">
          <div className="splash-glow-effect" />
          <img
            src="/sector pro logo.png"
            alt="Sector-Pro"
            className="splash-logo"
            onError={(e) => {
              // Fallback to lovable-uploads if main logo fails
              const target = e.target as HTMLImageElement;
              target.src = "/lovable-uploads/ce3ff31a-4cc5-43c8-b5bb-a4056d3735e4.png";
            }}
          />
        </div>

        <div className="splash-loading-text">Inicializando Sistema</div>

        <div className="splash-loading-bar-container">
          <div className="splash-loading-bar" />
        </div>
      </div>
    </>
  );
};

export default SplashScreen;
