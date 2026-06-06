import type { Metadata } from 'next';
import { WeddingInviteShowcase } from './WeddingInviteShowcase';

export const metadata: Metadata = {
  title: 'Wedding Invite Showcase',
  description: 'Mobile-first wedding invite MVP with explicit content placeholders and RSVP states.',
};

export default function WeddingInvitePage() {
  return <WeddingInviteShowcase />;
}
