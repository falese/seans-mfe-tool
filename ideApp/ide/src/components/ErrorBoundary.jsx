import React from 'react';
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';

const ErrorFallback = ({ error, resetErrorBoundary }) => (
  <div className="h-full w-full flex flex-col items-center justify-center p-4">
    <h2 className="text-xl font-semibold text-red-600">Something went wrong</h2>
    <p className="text-gray-600 mt-2">{error.message}</p>
    <button 
      onClick={resetErrorBoundary}
      className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
    >
      Try again
    </button>
  </div>
);

export const ErrorBoundary = ({ children }) => (
  <ReactErrorBoundary
    FallbackComponent={ErrorFallback}
    onReset={() => {
      // Reset any state that might have caused the error
      window.location.reload();
    }}
  >
    {children}
  </ReactErrorBoundary>
);

export default ErrorBoundary;