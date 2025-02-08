
import { ArrowRight } from 'lucide-react';

const Hero = () => {
  return (
    <div className="relative min-h-[80vh] flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(120,119,198,0.1),rgba(255,255,255,0))]" />
      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center max-w-3xl mx-auto space-y-8">
          <p className="text-sm font-medium px-4 py-2 rounded-full bg-secondary inline-block fade-in">
            Welcome to your new project
          </p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight slide-up">
            Create something amazing
          </h1>
          <p className="text-xl text-muted-foreground slide-up" style={{ animationDelay: '0.1s' }}>
            Start building your next great idea with this beautifully crafted template
          </p>
          <div className="flex justify-center gap-4 slide-up" style={{ animationDelay: '0.2s' }}>
            <button className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity">
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Hero;
