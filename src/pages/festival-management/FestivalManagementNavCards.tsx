import { Calendar, Layout, Library, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type FestivalManagementNavCardsProps = {
  artistCount: number;
  canImportRiders: boolean;
  isPlanningViewOnly: boolean;
  isViewOnly: boolean;
  jobId: string;
  navigate: (path: string) => void;
  onOpenRiderLibrary: () => void;
};

export const FestivalManagementNavCards = ({
  artistCount,
  canImportRiders,
  isPlanningViewOnly,
  isViewOnly,
  jobId,
  navigate,
  onOpenRiderLibrary,
}: FestivalManagementNavCardsProps) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
    <Card
      className="group hover:shadow-xl hover:scale-[1.02] transition-all duration-300 cursor-pointer border-2 hover:border-primary/50 bg-gradient-to-br from-background to-accent/5"
      onClick={() => navigate(`/festival-management/${jobId}/artists`)}
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-3 text-base md:text-lg">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500 group-hover:bg-blue-500/20 transition-colors">
            <Users className="h-5 w-5 md:h-6 md:w-6" />
          </div>
          <span className="group-hover:text-primary transition-colors">Artistas</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline gap-2">
          <p className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">
            {artistCount}
          </p>
          <p className="text-xs md:text-sm text-muted-foreground">Total de Artistas</p>
        </div>
        <Button
          className="w-full group-hover:shadow-md transition-shadow"
          size="sm"
          onClick={(event) => {
            event.stopPropagation();
            navigate(`/festival-management/${jobId}/artists`);
          }}
        >
          {isViewOnly ? "Ver Artistas" : "Gestionar Artistas"}
        </Button>
      </CardContent>
    </Card>

    <Card
      className="group hover:shadow-xl hover:scale-[1.02] transition-all duration-300 cursor-pointer border-2 hover:border-primary/50 bg-gradient-to-br from-background to-accent/5"
      onClick={() => navigate(`/festival-management/${jobId}/gear`)}
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-3 text-base md:text-lg">
          <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500 group-hover:bg-purple-500/20 transition-colors">
            <Layout className="h-5 w-5 md:h-6 md:w-6" />
          </div>
          <span className="group-hover:text-primary transition-colors">Escenarios y Equipo</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs md:text-sm text-muted-foreground min-h-[2.5rem]">Gestiona escenarios y equipo técnico</p>
        <Button
          className="w-full group-hover:shadow-md transition-shadow"
          size="sm"
          onClick={(event) => {
            event.stopPropagation();
            navigate(`/festival-management/${jobId}/gear`);
          }}
        >
          {isPlanningViewOnly ? "Ver Equipo" : "Gestionar Equipo"}
        </Button>
      </CardContent>
    </Card>

    <Card
      className="group hover:shadow-xl hover:scale-[1.02] transition-all duration-300 cursor-pointer border-2 hover:border-primary/50 bg-gradient-to-br from-background to-accent/5"
      onClick={() => navigate(`/festival-management/${jobId}/scheduling`)}
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-3 text-base md:text-lg">
          <div className="p-2 rounded-lg bg-green-500/10 text-green-500 group-hover:bg-green-500/20 transition-colors">
            <Calendar className="h-5 w-5 md:h-6 md:w-6" />
          </div>
          <span className="group-hover:text-primary transition-colors">Planificación</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs md:text-sm text-muted-foreground min-h-[2.5rem]">
          Gestiona turnos y asignaciones de personal
        </p>
        <Button
          className="w-full group-hover:shadow-md transition-shadow"
          size="sm"
          onClick={(event) => {
            event.stopPropagation();
            navigate(`/festival-management/${jobId}/scheduling`);
          }}
        >
          {isPlanningViewOnly ? "Ver Planificación" : "Gestionar Planificación"}
        </Button>
      </CardContent>
    </Card>

    {canImportRiders && (
      <Card
        className="group hover:shadow-xl hover:scale-[1.02] transition-all duration-300 cursor-pointer border-2 hover:border-primary/50 bg-gradient-to-br from-background to-accent/5"
        onClick={onOpenRiderLibrary}
      >
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-3 text-base md:text-lg">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-600 group-hover:bg-cyan-500/20 transition-colors">
              <Library className="h-5 w-5 md:h-6 md:w-6" />
            </div>
            <span className="group-hover:text-primary transition-colors">Biblioteca de Riders</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs md:text-sm text-muted-foreground min-h-[2.5rem]">
            Importa riders existentes como copias técnicas para este trabajo
          </p>
          <Button
            className="w-full group-hover:shadow-md transition-shadow"
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              onOpenRiderLibrary();
            }}
          >
            Abrir Biblioteca
          </Button>
        </CardContent>
      </Card>
    )}
  </div>
);
