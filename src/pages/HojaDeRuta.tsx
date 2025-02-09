import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import HojaDeRutaGenerator from "@/components/project-management/Hojaderuta";

const HojaDeRuta = () => {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto px-4 py-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/project-management')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <CardTitle>Hoja de Ruta Generator</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <HojaDeRutaGenerator />
        </CardContent>
      </Card>
    </div>
  );
};

export default HojaDeRuta;