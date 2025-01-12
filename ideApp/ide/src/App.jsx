import React, { Suspense, useState } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Loader2 } from 'lucide-react';

// Federated Modules
const EditorPanel = React.lazy(() => import('editor/EditorPanel'));

// Loading Component
const LoadingPanel = () => (
  <div className="h-full w-full flex items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin" />
  </div>
);

// Error Fallback
const ErrorFallback = ({ error, resetErrorBoundary }) => (
  <div className="h-full w-full flex flex-col items-center justify-center p-4">
    <h2 className="text-xl font-semibold text-red-600">Failed to load editor</h2>
    <p className="text-gray-600 mt-2">{error.message}</p>
    <button 
      onClick={resetErrorBoundary}
      className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
    >
      Retry
    </button>
  </div>
);

const App = () => {
  const [activeFile, setActiveFile] = useState(null);

  const handleFileChange = (file) => {
    setActiveFile(file);
    // Broadcast file change to other panels
    window.postMessage({
      type: 'FILE_CHANGED',
      payload: file
    }, '*');
  };

  return (
    <div className="h-screen w-screen flex flex-col">
      <header className="h-12 bg-gray-800 text-white flex items-center px-4">
        <h1>MFE Development Studio</h1>
      </header>

      <main className="flex-1 flex">
        {/* Left Sidebar - Will be Template Panel */}
        <aside className="w-64 bg-gray-100 border-r"></aside>

        {/* Main Editor Area */}
        <div className="flex-1 flex flex-col">
          <ErrorBoundary FallbackComponent={ErrorFallback}>
            <Suspense fallback={<LoadingPanel />}>
              <EditorPanel 
                activeFile={activeFile}
                onFileChange={handleFileChange}
              />
            </Suspense>
          </ErrorBoundary>
        </div>

        {/* Right Sidebar - Will be Preview Panel */}
        <aside className="w-96 bg-gray-100 border-l"></aside>
      </main>
    </div>
  );
};

export default App;