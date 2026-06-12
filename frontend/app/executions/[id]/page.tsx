import { Suspense } from 'react';
import ExecutionDetailPageContent from './ExecutionDetailPageContent';

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata = {
  title: 'Execution Trace - AgentOS',
  description: 'View structured agent execution traces and spans.',
};

export default async function Page({ params }: PageProps) {
  const resolvedParams = await params;
  return (
    <Suspense fallback={<div className="p-8 text-gray-400 animate-pulse">Loading execution details…</div>}>
      <ExecutionDetailPageContent id={resolvedParams.id} />
    </Suspense>
  );
}
