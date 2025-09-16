import { redirect } from 'next/navigation';

/** Clients are managed on their own page; settings links there. */
export default async function SettingsClients({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  redirect(`/${org}/clients`);
}
