export interface DirectMessage {
  id: string;
  content: string;
  created_at: string;
  status: 'read' | 'unread';
  sender: {
    id: string;
    first_name: string;
    last_name: string;
  };
  recipient: {
    id: string;
    first_name: string;
    last_name: string;
  };
  sender_id: string;
  recipient_id: string;
}

export interface Message {
  id: string;
  content: string;
  created_at: string;
  department: string;
  sender_id: string;
  status: 'read' | 'unread';
  sender: {
    id: string;
    first_name: string;
    last_name: string;
  };
}