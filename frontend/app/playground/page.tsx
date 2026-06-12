import { Suspense } from 'react';
import PlaygroundForm from './PlaygroundForm';

export const metadata = {
  title: 'Playground - AgentOS',
  description: 'Interactively test and run your deployed agents.',
};

export default function PlaygroundPage() {
  return (
    <Suspense fallback={<div className="page-content text-gray-400">Loading playground...</div>}>
      <PlaygroundForm />
    </Suspense>
  );
}
