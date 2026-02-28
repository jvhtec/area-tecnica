import React from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Edit2, Trash2, FolderPlus, Folder, CheckCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { DateType, getDateTypeMeta, TOUR_DATE_TYPE_OPTIONS } from "@/constants/dateTypes";

interface TourDateListItemProps {
  dateObj: any;
  isEditing: boolean;
  editingDate: string;
  editingLocation: string;
  editingTourDateType: DateType;
  editingStartDate: string;
  editingEndDate: string;
  setEditingDate: (value: string) => void;
  setEditingLocation: (value: string) => void;
  setEditingTourDateType: (value: DateType) => void;
  setEditingStartDate: (value: string) => void;
  setEditingEndDate: (value: string) => void;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onCreateFolders: () => void;
  hasFlexFolders: boolean;
  isCreatingFolders: boolean;
  readOnly?: boolean;
}

export const TourDateListItem: React.FC<TourDateListItemProps> = ({
  dateObj,
  isEditing,
  editingDate,
  editingLocation,
  editingTourDateType,
  editingStartDate,
  editingEndDate,
  setEditingDate,
  setEditingLocation,
  setEditingTourDateType,
  setEditingStartDate,
  setEditingEndDate,
  onEdit,
  onSave,
  onCancel,
  onDelete,
  onCreateFolders,
  hasFlexFolders,
  isCreatingFolders,
  readOnly = false,
}) => {
  const getTypeIcon = (type: string) => {
    const meta = getDateTypeMeta(type);
    const Icon = meta?.icon;
    if (!Icon) return null;
    return <Icon className={`h-4 w-4 ${meta?.iconClassName ?? ""}`} />;
  };

  const getTypeColor = (type: string) => {
    return getDateTypeMeta(type)?.badgeClassName ?? getDateTypeMeta("show")!.badgeClassName;
  };

  const formatDateRange = (startDate: string, endDate: string, type: string) => {
    if (!startDate) return '';
    
    const start = new Date(startDate);
    const end = new Date(endDate || startDate);
    
    if (type === 'rehearsal' && startDate !== endDate) {
      return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
    }
    
    return format(start, 'MMM d, yyyy');
  };

  const getDuration = (startDate: string, endDate: string) => {
    if (!startDate || !endDate || startDate === endDate) return null;
    const days = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return `${days} days`;
  };

  if (isEditing) {
    return (
      <div className="p-4 border rounded-lg bg-muted/50">
        <div className="space-y-4">
          <Input
            type="date"
            value={editingDate}
            onChange={(e) => setEditingDate(e.target.value)}
          />
          <Input
            type="text"
            value={editingLocation}
            onChange={(e) => setEditingLocation(e.target.value)}
          />
          <Select value={editingTourDateType} onValueChange={setEditingTourDateType}>
            <SelectTrigger>
              <SelectValue placeholder="Select date type" />
            </SelectTrigger>
            <SelectContent>
              {TOUR_DATE_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={editingStartDate}
            onChange={(e) => setEditingStartDate(e.target.value)}
          />
          <Input
            type="date"
            value={editingEndDate}
            onChange={(e) => setEditingEndDate(e.target.value)}
          />
          <div className="flex gap-2">
            <Button onClick={onSave} size="sm">
              <CheckCircle className="h-4 w-4 mr-2" />
              Save
            </Button>
            <Button onClick={onCancel} variant="outline" size="sm">
              Cancel
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {getTypeIcon(dateObj.tour_date_type)}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {formatDateRange(dateObj.start_date || dateObj.date, dateObj.end_date || dateObj.date, dateObj.tour_date_type)}
                </span>
                <Badge className={getTypeColor(dateObj.tour_date_type)}>
                  {getDateTypeMeta(dateObj.tour_date_type)?.labelEs || "Concierto"}
                </Badge>
                {getDuration(dateObj.start_date || dateObj.date, dateObj.end_date || dateObj.date) && (
                  <span className="text-sm text-muted-foreground">
                    ({getDuration(dateObj.start_date || dateObj.date, dateObj.end_date || dateObj.date)})
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {dateObj.location?.name}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onCreateFolders}
            disabled={isCreatingFolders}
            className="flex items-center gap-2"
          >
            {isCreatingFolders ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : hasFlexFolders ? (
              <Folder className="h-4 w-4" />
            ) : (
              <FolderPlus className="h-4 w-4" />
            )}
            {hasFlexFolders ? 'View Folders' : 'Create Folders'}
          </Button>

          {!readOnly && (
            <>
              <Button variant="outline" size="sm" onClick={onEdit}>
                <Edit2 className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={onDelete} className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
