import { Suspense } from 'react';
import ChatKitWithMetadata from './ChatKitWithMetadata';

export default function ChatKitPage() {
  return (
    <Suspense fallback={
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '18px',
        color: '#666'
      }}>
        Chargement du ChatKit...
      </div>
    }>
      <ChatKitWithMetadata />
    </Suspense>
  );
}
