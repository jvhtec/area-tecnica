
import { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface FeatureCardProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  description: string;
  icon: React.ReactNode;
}

const FeatureCard = ({ title, description, icon, className, ...props }: FeatureCardProps) => {
  return (
    <div
      className={cn(
        "glass-card hover-lift rounded-lg p-6 flex flex-col items-start gap-4",
        className
      )}
      {...props}
    >
      <div className="p-2 rounded-md bg-secondary inline-flex">
        {icon}
      </div>
      <h3 className="text-xl font-semibold tracking-tight">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
};

export default FeatureCard;
