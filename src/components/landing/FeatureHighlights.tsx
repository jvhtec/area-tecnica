import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  Users, 
  FolderOpen, 
  Smartphone, 
  Layers, 
  Zap,
  Shield,
  Clock,
  Download
} from "lucide-react";

const features = [
  {
    icon: FileText,
    title: "Professional PDF Reports",
    description: "Generate comprehensive technical reports with custom logos, detailed equipment lists, and professional formatting for every department.",
    highlight: "50+ Report Types"
  },
  {
    icon: Users,
    title: "Real-time Collaboration",
    description: "Work seamlessly with your team across all departments with live updates, instant notifications, and synchronized data.",
    highlight: "Live Updates"
  },
  {
    icon: FolderOpen,
    title: "Flex Integration",
    description: "Native integration with Flex systems for automated folder creation, document management, and seamless workflow integration.",
    highlight: "Native Integration"
  },
  {
    icon: Smartphone,
    title: "Mobile Responsive",
    description: "Access all features on any device with our fully responsive design optimized for tablets, phones, and desktop computers.",
    highlight: "Any Device"
  },
  {
    icon: Layers,
    title: "Multi-Department Support",
    description: "Specialized interfaces and tools for Sound, Lighting, Video, Production, Personnel, and Commercial departments.",
    highlight: "6 Departments"
  },
  {
    icon: Zap,
    title: "Lightning Fast",
    description: "Built with modern technology stack for optimal performance, instant loading, and smooth user experience.",
    highlight: "< 1s Load Time"
  },
  {
    icon: Shield,
    title: "Enterprise Security",
    description: "Bank-level security with encrypted data transmission, secure authentication, and compliance with industry standards.",
    highlight: "Bank-Level Security"
  },
  {
    icon: Clock,
    title: "Automated Scheduling",
    description: "Smart scheduling algorithms that prevent conflicts, optimize resource allocation, and send automatic notifications.",
    highlight: "Smart Algorithms"
  },
  {
    icon: Download,
    title: "Offline Capabilities",
    description: "Continue working even without internet connection with offline data synchronization and local storage capabilities.",
    highlight: "Offline Ready"
  }
];

export const FeatureHighlights = () => {
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
          <Badge variant="secondary" className="mb-4">
            Advanced Features
          </Badge>
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            Built for Professional Excellence
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Every feature is designed with professional technical teams in mind, 
            ensuring reliability, efficiency, and comprehensive functionality.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 50 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.8, delay: index * 0.1 }}
            >
              <Card className="h-full hover:shadow-lg transition-all duration-300 group">
                <CardContent className="p-6">
                  <motion.div
                    whileHover={{ scale: 1.1 }}
                    className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 rounded-full mb-4 group-hover:bg-primary/20 transition-colors"
                  >
                    <feature.icon className="w-6 h-6 text-primary" />
                  </motion.div>

                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold">{feature.title}</h3>
                    <Badge variant="outline" className="text-xs">
                      {feature.highlight}
                    </Badge>
                  </div>

                  <p className="text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Additional CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="text-center mt-16"
        >
          <div className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-2xl p-8 lg:p-12">
            <h3 className="text-2xl lg:text-3xl font-bold mb-4">
              Ready to Transform Your Technical Operations?
            </h3>
            <p className="text-muted-foreground text-lg mb-6 max-w-2xl mx-auto">
              Join the hundreds of technical professionals who trust Sector Pro 
              for their most critical events and projects.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-primary text-primary-foreground px-8 py-3 rounded-lg font-semibold hover:bg-primary/90 transition-colors"
              >
                Start Free Trial
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="border border-primary text-primary px-8 py-3 rounded-lg font-semibold hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                Schedule Demo
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};