import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Department } from '@/types/department';

interface OfferDetailsDialogProps {
  open: boolean;
  onClose: () => void;
  technicianName: string;
  jobTitle?: string;
  technicianDepartment: Department | string;
  onSubmit: (details: { role: string; message: string }) => void;
}

const getRoleOptions = (department: string): string[] => {
  switch (department) {
    case 'sound':
      return ['FOH Engineer', 'Monitor Engineer', 'PA Tech', 'RF Tech'];
    case 'lights':
      return ['Lighting Designer', 'Lighting Tech', 'Follow Spot'];
    case 'video':
      return ['Video Director', 'Camera Operator', 'Video Tech'];
    default:
      return ['Technician', 'Stagehand', 'Other'];
  }
};

export const OfferDetailsDialog: React.FC<OfferDetailsDialogProps> = ({ open, onClose, technicianName, jobTitle, technicianDepartment, onSubmit }) => {
  const [role, setRole] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = () => {
    onSubmit({ role: role.trim(), message: message.trim() });
  };

  const roleOptions = getRoleOptions(technicianDepartment);
  React.useEffect(() => {
    if (open && roleOptions.length && !role) setRole(roleOptions[0]);
  }, [open, technicianDepartment]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send Offer {jobTitle ? `- ${jobTitle}` : ''}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label>Technician</Label>
            <div className="text-sm text-muted-foreground">{technicianName}</div>
          </div>
          <div>
            <Label htmlFor="role">Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="role">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map((opt) => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="message">Message (optional)</Label>
            <Textarea id="message" placeholder="Additional details to include in the email" value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!role.trim()}>Send Offer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
