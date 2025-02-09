import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SignUpForm } from "@/components/auth/SignUpForm";

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateUserDialog = ({ open, onOpenChange }: CreateUserDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
        </DialogHeader>
        <SignUpForm 
          onBack={() => onOpenChange(false)} 
          preventAutoLogin={true}  // Prevent auto-login when creating users from settings
        />
      </DialogContent>
    </Dialog>
  );
};