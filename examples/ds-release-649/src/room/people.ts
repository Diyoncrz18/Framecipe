// Room cast. Portraits in public/people are FLUX.2 (AI-generated); the video says so on screen.
export type Role = 'Moderators' | 'Speakers' | 'Attendees';

export type Person = {
  id: string;
  name: string;
  role: Role;
  img?: string; // public/people/<img>.jpg
  color: string; // avatarColor
  you?: boolean;
};

export const PEOPLE: Person[] = [
  { id: 'lena', name: 'Lena Fischer', role: 'Moderators', color: '#7e57c2', you: true },
  { id: 'matthias', name: 'Matthias Keller', role: 'Speakers', img: 'matthias', color: '#d4a03a' },
  { id: 'elena', name: 'Elena Moreau', role: 'Speakers', img: 'elena', color: '#e0745a' },
  { id: 'sofia', name: 'Sofia Marinelli', role: 'Attendees', img: 'sofia', color: '#7b5ea7' },
  { id: 'jonas', name: 'Jonas Lindberg', role: 'Attendees', img: 'jonas', color: '#3a9a8a' },
  { id: 'julien', name: 'Julien Fontaine', role: 'Attendees', img: 'julien', color: '#4caf50' },
  { id: 'mateo', name: 'Mateo Fernández', role: 'Attendees', img: 'mateo', color: '#7c83e0' },
  { id: 'isabelle', name: 'Isabelle Williamson', role: 'Attendees', img: 'isabelle', color: '#e53935' },
  { id: 'mei', name: 'Mei Tanaka', role: 'Attendees', img: 'amara', color: '#00897b' },
];

export const initials = (name: string) => {
  const w = name.split(' ');
  return (w[0][0] + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase();
};

export const byId = (id: string) => PEOPLE.find((p) => p.id === id)!;
