import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Calendar, 
  Music, 
  Lightbulb, 
  Video, 
  Users, 
  FileText, 
  Settings,
  Truck,
  Calculator,
  MessageSquare,
  ArrowRight,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import festivalManagement from "@/assets/landing/festival-management.jpg";
import soundEquipment from "@/assets/landing/sound-equipment.jpg";

const modules = [
  {
    icon: Music,
    title: "Festival Management",
    subtitle: "Complete Festival Operations",
    description: "Manage artists, requirements, gear setup, and scheduling all in one place. Generate professional PDF reports with technical riders and stage plots.",
    image: festivalManagement,
    features: [
      "Artist requirements and technical riders",
      "Multi-stage gear configuration",
      "Automated scheduling and time management",
      "PDF report generation with logos",
      "Real-time gear comparison and validation"
    ],
    badge: "Most Popular"
  },
  {
    icon: Calendar,
    title: "Tour Management",
    subtitle: "Multi-Date Coordination",
    description: "Streamline tour operations with date management, folder creation, and automated defaults system for consistent technical standards.",
    image: soundEquipment,
    features: [
      "Multi-date tour coordination",
      "Flex folder integration",
      "Tour defaults and templates",
      "Logistics coordination",
      "Weight and power calculations"
    ]
  },
  {
    icon: Lightbulb,
    title: "Technical Departments",
    subtitle: "Sound, Lights & Video",
    description: "Specialized tools for each technical department with memoria técnica generation, equipment management, and technical calculations.",
    image: soundEquipment,
    features: [
      "Department-specific interfaces",
      "Technical memoria generation",
      "Equipment inventory tracking",
      "Power and weight calculations",
      "Professional PDF reports"
    ]
  },
  {
    icon: Calculator,
    title: "Weight & Power Tools",
    subtitle: "Pesos & Consumos Calculators",
    description: "Advanced calculators for technical load planning with automatic PDF export and professional technical documentation.",
    image: soundEquipment,
    features: [
      "Weight distribution calculations",
      "Power consumption analysis",
      "Automatic PDF generation",
      "Technical load planning",
      "Safety compliance reports"
    ]
  },
  {
    icon: Users,
    title: "Assignment Matrix",
    subtitle: "Staff Scheduling",
    description: "Real-time staff assignment matrix with availability tracking, conflict resolution, and automated notifications.",
    image: soundEquipment,
    features: [
      "Real-time availability tracking",
      "Conflict detection and resolution",
      "Automated assignment notifications",
      "Skills-based matching",
      "Overtime and schedule optimization"
    ]
  },
  {
    icon: Settings,
    title: "Equipment Management",
    subtitle: "Inventory & Stock Control",
    description: "Complete equipment lifecycle management with stock tracking, maintenance schedules, and availability monitoring.",
    image: soundEquipment,
    features: [
      "Real-time inventory tracking",
      "Maintenance scheduling",
      "Availability monitoring",
      "Equipment history logs",
      "Automated reorder alerts"
    ]
  }
];

export const ModuleShowcase = () => {
  const [expandedModule, setExpandedModule] = useState<number | null>(null);
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
            Complete Feature Set
          </Badge>
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            Everything You Need in One Platform
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            From festival management to tour coordination, our specialized modules cover every aspect 
            of technical event management with professional-grade tools and reporting.
          </p>
        </motion.div>

        <div className="space-y-8">
          {modules.map((module, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 50 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.8, delay: index * 0.1 }}
            >
              <Card className="overflow-hidden hover:shadow-xl transition-all duration-300">
                <CardContent className="p-0">
                  <div className={`grid lg:grid-cols-2 gap-0 ${index % 2 === 1 ? 'lg:grid-flow-dense' : ''}`}>
                    {/* Content Section */}
                    <div className={`p-8 lg:p-12 flex flex-col justify-center ${index % 2 === 1 ? 'lg:col-start-2' : ''}`}>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 rounded-full">
                          <module.icon className="w-6 h-6 text-primary" />
                        </div>
                        {module.badge && (
                          <Badge variant="default" className="bg-primary">
                            {module.badge}
                          </Badge>
                        )}
                      </div>

                      <h3 className="text-2xl lg:text-3xl font-bold mb-2">
                        {module.title}
                      </h3>
                      <p className="text-primary font-semibold mb-4">
                        {module.subtitle}
                      </p>
                      <p className="text-muted-foreground text-lg mb-6 leading-relaxed">
                        {module.description}
                      </p>

                      <Button
                        variant="ghost"
                        onClick={() => setExpandedModule(expandedModule === index ? null : index)}
                        className="justify-between w-fit mb-4"
                      >
                        View Features
                        {expandedModule === index ? 
                          <ChevronUp className="w-4 h-4 ml-2" /> : 
                          <ChevronDown className="w-4 h-4 ml-2" />
                        }
                      </Button>

                      <motion.div
                        initial={false}
                        animate={{
                          height: expandedModule === index ? "auto" : 0,
                          opacity: expandedModule === index ? 1 : 0
                        }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <div className="space-y-3 pb-6">
                          {module.features.map((feature, featureIndex) => (
                            <div key={featureIndex} className="flex items-center gap-3">
                              <div className="w-2 h-2 bg-primary rounded-full" />
                              <span className="text-muted-foreground">{feature}</span>
                            </div>
                          ))}
                        </div>
                      </motion.div>

                      <Button className="w-fit group">
                        Learn More
                        <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </div>

                    {/* Image Section */}
                    <div className={`relative overflow-hidden ${index % 2 === 1 ? 'lg:col-start-1 lg:row-start-1' : ''}`}>
                      <motion.div
                        whileHover={{ scale: 1.05 }}
                        transition={{ duration: 0.3 }}
                        className="h-full min-h-[400px] lg:min-h-[500px]"
                      >
                        <img
                          src={module.image}
                          alt={module.title}
                          width={1200}
                          height={800}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover"
                        />
                        
                        {/* Gradient Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                        
                        {/* Feature Badge */}
                        <div className="absolute top-6 left-6">
                          <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
                            <module.icon className="w-4 h-4 mr-2" />
                            {module.title}
                          </Badge>
                        </div>
                      </motion.div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
