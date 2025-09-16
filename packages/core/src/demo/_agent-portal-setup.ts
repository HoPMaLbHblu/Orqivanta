/** Creates a throwaway review for Marcus (Harbor & Pine) so the portal decision flow can be exercised. */
import { createApproval, listFiles, resolveActor } from '@orqivanta/core';
import { eq, users, withSystem } from '@orqivanta/db';

const email = (e: string) => withSystem((tx) => tx.select({ id: users.id }).from(users).where(eq(users.email, e)));

const [maya] = await email('maya@northwind.example');
const [ruth] = await email('ruth@lumenhealth.example');
const actor = (await resolveActor(maya!.id, 'northwind'))!;
const files = await listFiles(actor, {});
const file = files.find((f) => f.projectKey === 'LUM' && f.sharedWithClient);
if (!file) throw new Error('no shared HPC file');
const a = await createApproval(actor, {
  projectId: file.projectId,
  title: 'Agent test review — please ignore',
  instructions: 'Temporary review created to exercise the portal decision flow.',
  fileId: file.id,
  reviewerIds: [ruth!.id],
  rule: 'any',
  dueDate: null,
});
console.log('APPROVAL', a.id);
