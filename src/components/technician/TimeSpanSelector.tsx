import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TimeSpanSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  viewMode: 'upcoming' | 'past';
}

export const TimeSpanSelector = ({ value, onValueChange, viewMode }: TimeSpanSelectorProps) => {
  const getDisplayText = () => {
    if (viewMode === 'upcoming') {
      switch (value) {
        case "1week": return "Próxima semana";
        case "2weeks": return "Próximas 2 semanas";
        case "1month": return "Próximo mes";
        case "3months": return "Próximos 3 meses";
        default: return "Próxima semana";
      }
    }

    switch (value) {
      case "1week": return "Semana pasada";
      case "2weeks": return "Últimas 2 semanas";
      case "1month": return "Mes pasado";
      case "3months": return "Últimos 3 meses";
      default: return "Semana pasada";
    }
  };

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Selecciona el periodo">
          {getDisplayText()}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="1week">{viewMode === 'upcoming' ? 'Próxima semana' : 'Semana pasada'}</SelectItem>
        <SelectItem value="2weeks">{viewMode === 'upcoming' ? 'Próximas 2 semanas' : 'Últimas 2 semanas'}</SelectItem>
        <SelectItem value="1month">{viewMode === 'upcoming' ? 'Próximo mes' : 'Mes pasado'}</SelectItem>
        <SelectItem value="3months">{viewMode === 'upcoming' ? 'Próximos 3 meses' : 'Últimos 3 meses'}</SelectItem>
      </SelectContent>
    </Select>
  );
};