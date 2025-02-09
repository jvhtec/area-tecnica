import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SendMessage } from "@/components/messages/SendMessage";
import { MessagesList } from "@/components/messages/MessagesList";
import { DirectMessagesList } from "@/components/messages/DirectMessagesList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface MessageManagementDialogProps {
  department: string | null;
  trigger?: boolean;
}

export const MessageManagementDialog = ({ department, trigger = true }: MessageManagementDialogProps) => {
  const content = (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Messages</DialogTitle>
      </DialogHeader>
      <Tabs defaultValue="department" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="department" className="flex-1">Department Messages</TabsTrigger>
          <TabsTrigger value="direct" className="flex-1">Direct Messages</TabsTrigger>
        </TabsList>
        <TabsContent value="department" className="space-y-4">
          {department && <SendMessage department={department} />}
          <MessagesList />
        </TabsContent>
        <TabsContent value="direct" className="space-y-4">
          <DirectMessagesList />
        </TabsContent>
      </Tabs>
    </DialogContent>
  );

  if (!trigger) {
    return content;
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <MessageSquare className="h-4 w-4" />
          Message Management
        </Button>
      </DialogTrigger>
      {content}
    </Dialog>
  );
};