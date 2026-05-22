export type Dept = 'sound' | 'lights' | 'video';

export type WahaParticipantObject = {
  id: string;
};

export const phoneToWahaJid = (phone: string) => `${phone.replace(/^\+/, '').replace(/\D/g, '')}@c.us`;

export const buildWahaGroupParticipants = ({
  actorJid,
  participants,
}: {
  actorJid?: string | null;
  participants: string[];
}) => {
  const allParticipants = participants.map<WahaParticipantObject>((phone) => ({ id: phoneToWahaJid(phone) }));
  const groupParticipants = actorJid
    ? allParticipants.filter((participant) => participant.id !== actorJid)
    : allParticipants;

  return {
    allParticipants,
    groupParticipants,
  };
};
