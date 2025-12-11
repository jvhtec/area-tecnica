import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bug, Lightbulb, Settings } from "lucide-react";
import { BugReportForm } from "@/components/feedback/BugReportForm";
import { FeatureRequestForm } from "@/components/feedback/FeatureRequestForm";
import { AdminPanel } from "@/components/feedback/AdminPanel";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { initConsoleCapture } from "@/utils/consoleCapture";

export default function Feedback() {
  const { userRole } = useOptimizedAuth();
  const [activeTab, setActiveTab] = useState("bug");

  const isAdmin = userRole === "admin" || userRole === "management";

  // Initialize console capture when component mounts
  useEffect(() => {
    const capture = initConsoleCapture();

    // Restore original console methods on unmount
    return () => {
      capture.restore();
    };
  }, []);

  return (
    <div className="container mx-auto py-6 px-4 max-w-5xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Comentarios y soporte</h1>
          <p className="text-muted-foreground mt-2">
            Ayúdanos a mejorar la aplicación reportando errores o solicitando nuevas funciones
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className={`grid w-full ${isAdmin ? "grid-cols-3" : "grid-cols-2"}`}>
            <TabsTrigger value="bug" className="flex items-center gap-2">
              <Bug className="h-4 w-4" />
              Reportar error
            </TabsTrigger>
            <TabsTrigger value="feature" className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              Solicitar función
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="admin" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Panel de gestión
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="bug" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Reportar un error</CardTitle>
                <CardDescription>
                  Cuéntanos sobre cualquier problema que hayas encontrado en la aplicación
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BugReportForm />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="feature" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Solicitar una nueva función</CardTitle>
                <CardDescription>
                  Comparte tus ideas para mejorar la aplicación
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FeatureRequestForm />
              </CardContent>
            </Card>
          </TabsContent>

          {isAdmin && (
            <TabsContent value="admin" className="space-y-4">
              <AdminPanel />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
