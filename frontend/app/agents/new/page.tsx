import { Suspense } from 'react';
import NewAgentForm from './NewAgentForm';

export const metadata = {
  title: 'New Agent - AgentOS',
  description: 'Create a new agent or agent version.',
};

export default function NewAgentPage() {
  return (
    <Suspense fallback={<div className="page-content text-gray-400">Loading form...</div>}>
      <NewAgentForm />
    </Suspense>
  );
}
