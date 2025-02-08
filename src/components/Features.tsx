
import { Layers, Zap, Shield } from 'lucide-react';
import FeatureCard from './FeatureCard';

const Features = () => {
  return (
    <section className="py-24 relative">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <FeatureCard
            icon={<Layers className="w-5 h-5" />}
            title="Built for Scale"
            description="Designed with modern architecture to handle any size project with ease."
          />
          <FeatureCard
            icon={<Zap className="w-5 h-5" />}
            title="Lightning Fast"
            description="Optimized performance ensures your application runs at peak efficiency."
          />
          <FeatureCard
            icon={<Shield className="w-5 h-5" />}
            title="Rock Solid"
            description="Enterprise-grade security and reliability built into every layer."
          />
        </div>
      </div>
    </section>
  );
};

export default Features;
