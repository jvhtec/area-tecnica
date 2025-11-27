import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MessagesList } from "@/components/messages/MessagesList";
import { DirectMessagesList } from "@/components/messages/DirectMessagesList";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { useState } from "react";
import { DirectMessageDialog } from "@/components/messages/DirectMessageDialog";

interface MessagesDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const MessagesDialog = ({ open, onOpenChange }: MessagesDialogProps) => {
    const [newMessageDialogOpen, setNewMessageDialogOpen] = useState(false);

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-[#0f1219] border-[#1f232e] text-slate-100">
                    <DialogHeader className="flex flex-row items-center justify-between">
                        <DialogTitle>Mensajes</DialogTitle>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="gap-2 text-blue-400 hover:text-blue-300 hover:bg-[#1f232e]"
                            onClick={() => setNewMessageDialogOpen(true)}
                        >
                            <Send className="w-4 h-4" />
                            Nuevo Mensaje
                        </Button>
                    </DialogHeader>

                    <div className="space-y-6 mt-4">
                        <MessagesList isDark={true} />
                        <div className="border-t border-[#1f232e] pt-4">
                            <h4 className="text-xs font-medium text-slate-500 mb-3 uppercase">Directos</h4>
                            <DirectMessagesList />
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <DirectMessageDialog
                open={newMessageDialogOpen}
                onOpenChange={setNewMessageDialogOpen}
            />
        </>
    );
};
