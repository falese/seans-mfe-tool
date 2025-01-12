// editor/src/services/EditorService.js
class EditorService {
    constructor() {
      this.fileWatchers = new Map();
      this.onFileChangeCallbacks = new Set();
    }
  
    // File operations
    async openFile(path) {
      try {
        const content = await window.electronAPI.readFile(path);
        this.watchFile(path);
        return content;
      } catch (error) {
        console.error(`Failed to open file: ${path}`, error);
        throw error;
      }
    }
  
    async saveFile(path, content) {
      try {
        await window.electronAPI.writeFile(path, content);
        this.notifyFileChanged(path);
      } catch (error) {
        console.error(`Failed to save file: ${path}`, error);
        throw error;
      }
    }
  
    // File watching
    watchFile(path) {
      if (this.fileWatchers.has(path)) return;
  
      const watcher = window.electronAPI.watchFile(path, () => {
        this.notifyFileChanged(path);
      });
  
      this.fileWatchers.set(path, watcher);
    }
  
    unwatchFile(path) {
      const watcher = this.fileWatchers.get(path);
      if (watcher) {
        watcher.close();
        this.fileWatchers.delete(path);
      }
    }
  
    // Change notifications
    onFileChange(callback) {
      this.onFileChangeCallbacks.add(callback);
      return () => this.onFileChangeCallbacks.delete(callback);
    }
  
    notifyFileChanged(path) {
      this.onFileChangeCallbacks.forEach(callback => callback(path));
    }
  
    // MFE-specific operations
    async validateModuleFederation(config) {
      // Validate module federation configuration
      const errors = [];
      
      if (!config.name) {
        errors.push('Module name is required');
      }
      
      if (!config.filename) {
        errors.push('Entry filename is required');
      }
      
      if (!config.exposes || Object.keys(config.exposes).length === 0) {
        errors.push('At least one exposed module is required');
      }
      
      return {
        isValid: errors.length === 0,
        errors
      };
    }
  
    getComponentSuggestions(fileName) {
      // Return context-aware suggestions based on file type
      const suggestions = [];
      
      if (fileName.endsWith('.jsx') || fileName.endsWith('.tsx')) {
        suggestions.push(
          {
            label: 'federated-component',
            detail: 'Create a new federated component',
            documentation: 'Creates a new React component with Module Federation setup',
            insertText: this.getFederatedComponentTemplate()
          }
        );
      }
      
      return suggestions;
    }
  
    getFederatedComponentTemplate() {
      return `
  import React from 'react';
  import { ErrorBoundary } from 'react-error-boundary';
  
  const Component = () => {
    return (
      <div>
        {/* Component content */}
      </div>
    );
  };
  
  export default Component;
      `.trim();
    }
  }
  
  export const editorService = new EditorService();