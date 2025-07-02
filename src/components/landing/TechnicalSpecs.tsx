import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Code, 
  Database, 
  Smartphone, 
  Zap, 
  Shield, 
  Globe,
  Server,
  Cpu
} from "lucide-react";

const techSpecs = [
  {
    category: "Frontend Technology",
    icon: Code,
    items: [
      "React 18 with TypeScript",
      "Tailwind CSS for styling",
      "Framer Motion animations",
      "Shadcn/ui components",
      "Vite build system"
    ]
  },
  {
    category: "Backend & Database",
    icon: Database,
    items: [
      "Supabase PostgreSQL",
      "Real-time subscriptions",
      "Row Level Security (RLS)",
      "Edge Functions",
      "File storage integration"
    ]
  },
  {
    category: "Performance",
    icon: Zap,
    items: [
      "Sub-second load times",
      "Optimized bundle splitting",
      "Lazy loading components",
      "Service worker caching",
      "CDN acceleration"
    ]
  },
  {
    category: "Security",
    icon: Shield,
    items: [
      "JWT authentication",
      "Encrypted data transmission",
      "GDPR compliance",
      "Role-based access control",
      "Audit logging"
    ]
  },
  {
    category: "Mobile & Responsive",
    icon: Smartphone,
    items: [
      "Progressive Web App (PWA)",
      "Touch-optimized interface",
      "Offline functionality",
      "Cross-platform compatibility",
      "Native app experience"
    ]
  },
  {
    category: "Integrations",
    icon: Globe,
    items: [
      "Flex folder management",
      "PDF generation engine",
      "Email notifications",
      "Calendar synchronization",
      "External API support"
    ]
  }
];

const systemRequirements = [
  {
    icon: Server,
    title: "System Requirements",
    specs: [
      "Modern web browser (Chrome, Firefox, Safari, Edge)",
      "Internet connection for real-time features",
      "Minimum 4GB RAM recommended",
      "1GB free storage for offline data"
    ]
  },
  {
    icon: Cpu,
    title: "Performance Metrics",
    specs: [
      "99.9% uptime guaranteed",
      "< 100ms API response time",
      "< 1 second page load time",
      "Real-time data synchronization"
    ]
  }
];

export const TechnicalSpecs = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="py-20">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <Badge variant="secondary" className="mb-4">
            Technical Excellence
          </Badge>
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            Built with Modern Technology
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Sector Pro is built on a robust, scalable architecture using the latest 
            technologies to ensure reliability, performance, and future-proof functionality.
          </p>
        </motion.div>

        {/* Technology Stack */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {techSpecs.map((spec, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 50 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.8, delay: index * 0.1 }}
            >
              <Card className="h-full hover:shadow-lg transition-all duration-300">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-3 text-lg">
                    <div className="inline-flex items-center justify-center w-10 h-10 bg-primary/10 rounded-full">
                      <spec.icon className="w-5 h-5 text-primary" />
                    </div>
                    {spec.category}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {spec.items.map((item, itemIndex) => (
                      <li key={itemIndex} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* System Requirements */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
          {systemRequirements.map((requirement, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: index === 0 ? -50 : 50 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.8, delay: 0.3 }}
            >
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 rounded-full">
                      <requirement.icon className="w-6 h-6 text-primary" />
                    </div>
                    {requirement.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {requirement.specs.map((spec, specIndex) => (
                      <li key={specIndex} className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-green-500 rounded-full" />
                        <span className="text-muted-foreground">{spec}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Architecture Highlight */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="bg-gradient-to-r from-primary/5 to-secondary/5 rounded-2xl p-8 lg:p-12 text-center"
        >
          <h3 className="text-2xl lg:text-3xl font-bold mb-4">
            Enterprise-Grade Architecture
          </h3>
          <p className="text-muted-foreground text-lg mb-6 max-w-3xl mx-auto">
            Built with scalability, security, and performance in mind. Our modern tech stack 
            ensures your technical operations run smoothly, whether you're managing a single 
            event or coordinating multiple tours across different departments.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            {["React", "TypeScript", "Supabase", "PostgreSQL", "Real-time", "PWA"].map((tech, index) => (
              <Badge key={index} variant="secondary" className="px-4 py-2">
                {tech}
              </Badge>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};