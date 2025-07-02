import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import { Users, Calendar, FileText, Zap } from "lucide-react";

const stats = [
  {
    icon: Users,
    value: 10,
    suffix: "+",
    label: "Specialized Modules",
    description: "From festivals to tours, lighting to sound"
  },
  {
    icon: Calendar,
    value: 24,
    suffix: "/7",
    label: "Real-time Sync",
    description: "Live collaboration across all departments"
  },
  {
    icon: FileText,
    value: 50,
    suffix: "+",
    label: "Report Types",
    description: "Professional PDF generation for every need"
  },
  {
    icon: Zap,
    value: 99,
    suffix: ".9%",
    label: "Uptime",
    description: "Enterprise-grade reliability you can trust"
  }
];

const AnimatedCounter = ({ value, suffix, duration = 2 }: { value: number; suffix: string; duration?: number }) => {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (isInView) {
      const increment = value / (duration * 60); // 60 FPS
      const timer = setInterval(() => {
        setCount(prev => {
          const next = prev + increment;
          if (next >= value) {
            clearInterval(timer);
            return value;
          }
          return next;
        });
      }, 1000 / 60);

      return () => clearInterval(timer);
    }
  }, [isInView, value, duration]);

  return (
    <span ref={ref}>
      {Math.floor(count)}{suffix}
    </span>
  );
};

export const StatsSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="py-20 bg-muted/50">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            Trusted by Technical Professionals
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Join thousands of professionals who rely on Sector Pro for their most critical technical operations
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 50 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.8, delay: index * 0.2 }}
              className="text-center"
            >
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="bg-card rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={isInView ? { scale: 1 } : {}}
                  transition={{ duration: 0.5, delay: index * 0.2 + 0.3 }}
                  className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-6"
                >
                  <stat.icon className="w-8 h-8 text-primary" />
                </motion.div>

                <motion.div
                  className="text-4xl lg:text-5xl font-bold text-primary mb-2"
                  initial={{ opacity: 0 }}
                  animate={isInView ? { opacity: 1 } : {}}
                  transition={{ delay: index * 0.2 + 0.5 }}
                >
                  <AnimatedCounter value={stat.value} suffix={stat.suffix} />
                </motion.div>

                <h3 className="text-xl font-semibold mb-2">{stat.label}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {stat.description}
                </p>
              </motion.div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};