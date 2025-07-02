import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Mail, 
  Phone, 
  MapPin, 
  Clock, 
  CheckCircle, 
  ArrowRight,
  Sparkles,
  Star
} from "lucide-react";

const contactInfo = [
  {
    icon: Mail,
    label: "Email",
    value: "hello@sectorpro.com",
    action: "mailto:hello@sectorpro.com"
  },
  {
    icon: Phone,
    label: "Phone",
    value: "+1 (555) 123-4567",
    action: "tel:+15551234567"
  },
  {
    icon: MapPin,
    label: "Location",
    value: "Madrid, Spain",
    action: null
  },
  {
    icon: Clock,
    label: "Response Time",
    value: "< 24 hours",
    action: null
  }
];

const benefits = [
  "Free 30-day trial",
  "No setup fees",
  "Expert onboarding",
  "24/7 support",
  "Cancel anytime"
];

export const CallToAction = () => {
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setIsSubmitted(true);
      // Here you would typically send the email to your backend
      setTimeout(() => setIsSubmitted(false), 3000);
    }
  };

  return (
    <section ref={ref} className="py-20 bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="container mx-auto px-4">
        {/* Main CTA */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <Badge variant="secondary" className="mb-4">
            <Sparkles className="w-4 h-4 mr-2" />
            Ready to Get Started?
          </Badge>
          <h2 className="text-3xl lg:text-5xl font-bold mb-6">
            Transform Your Technical Operations
            <br />
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Starting Today
            </span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            Join hundreds of technical professionals who trust Sector Pro for their most critical 
            events. Start your free trial and experience the difference professional tools make.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12 max-w-6xl mx-auto">
          {/* Demo Request Form */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <Card className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-secondary/10" />
              <CardContent className="relative p-8">
                <div className="mb-6">
                  <h3 className="text-2xl font-bold mb-2">Start Your Free Trial</h3>
                  <p className="text-muted-foreground">
                    Get instant access to all features. No credit card required.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 mb-6">
                  <div className="space-y-2">
                    <label htmlFor="email" className="text-sm font-medium">
                      Email Address
                    </label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="h-12"
                    />
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full h-12 text-lg group"
                    disabled={isSubmitted}
                  >
                    {isSubmitted ? (
                      <>
                        <CheckCircle className="w-5 h-5 mr-2" />
                        Thank you! We'll be in touch.
                      </>
                    ) : (
                      <>
                        Start Free Trial
                        <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </Button>
                </form>

                <div className="space-y-3">
                  <p className="text-sm font-medium">What's included:</p>
                  {benefits.map((benefit, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-sm text-muted-foreground">{benefit}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-6 pt-6 border-t border-border">
                  <p className="text-center text-sm text-muted-foreground">
                    Trusted by technical professionals worldwide
                  </p>
                  <div className="flex justify-center mt-2">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 text-yellow-400 fill-current" />
                    ))}
                    <span className="ml-2 text-sm text-muted-foreground">4.9/5 rating</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Contact Information */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="space-y-6"
          >
            <div>
              <h3 className="text-2xl font-bold mb-4">Need More Information?</h3>
              <p className="text-muted-foreground mb-6">
                Our team is here to help you understand how Sector Pro can transform 
                your technical operations. Get in touch for a personalized demo.
              </p>
            </div>

            <div className="space-y-4">
              {contactInfo.map((contact, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.5, delay: 0.6 + index * 0.1 }}
                >
                  <Card className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="inline-flex items-center justify-center w-10 h-10 bg-primary/10 rounded-full">
                          <contact.icon className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-muted-foreground">{contact.label}</p>
                          {contact.action ? (
                            <a 
                              href={contact.action}
                              className="font-medium hover:text-primary transition-colors"
                            >
                              {contact.value}
                            </a>
                          ) : (
                            <p className="font-medium">{contact.value}</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            <div className="pt-6">
              <Button variant="outline" className="w-full h-12 text-lg group">
                Schedule a Demo
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </motion.div>
        </div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="text-center mt-16 pt-8 border-t border-border"
        >
          <p className="text-muted-foreground">
            © 2024 Sector Pro. Built for technical professionals, by technical professionals.
          </p>
        </motion.div>
      </div>
    </section>
  );
};