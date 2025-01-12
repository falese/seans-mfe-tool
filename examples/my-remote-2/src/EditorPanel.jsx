// editor/src/EditorPanel.jsx
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { Tabs, TabList, Tab, TabPanel } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Save, Split, PlayCircle } from 'lucide-react';

const SUPPORTED_LANGUAGES = {
  'jsx': 'javascript',
  'tsx': 'typescript',
  'js': 'javascript',
  'ts': 'typescript',
  'css': 'css',
  'json': 'json',
  'html': 'html'
};

const EditorPanel = () => {
  const [files, setFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [editorValue, setEditorValue] = useState('');
  const [isModified, setIsModified] = useState(false);
  
  // Handle file change
  const handleFileChange = (newValue) => {
    setEditorValue(newValue);
    setIsModified(true);
  };

  // Save current file
  const handleSave = async () => {
    if (!activeFile) return;
    
    try {
      // We'll implement this in the FileSystem service
      await window.electronAPI.saveFile(activeFile.path, editorValue);
      setIsModified(false);
    } catch (error) {
      console.error('Failed to save file:', error);
    }
  };

  // Get file language
  const getFileLanguage = (filename) => {
    const ext = filename.split('.').pop();
    return SUPPORTED_LANGUAGES[ext] || 'plaintext';
  };

  // Editor configuration
  const editorOptions = {
    minimap: { enabled: false },
    fontSize: 14,
    lineHeight: 24,
    padding: { top: 16 },
    fontFamily: 'JetBrains Mono, monospace',
    formatOnType: true,
    formatOnPaste: true,
    suggestOnTriggerCharacters: true,
    quickSuggestions: true,
    rulers: [80],
    bracketPairColorization: {
      enabled: true
    }
  };

  // Custom completions for MFE components
  const setupCustomCompletions = (monaco) => {
    monaco.languages.registerCompletionItemProvider('javascript', {
      provideCompletionItems: (model, position) => {
        const suggestions = [
          {
            label: 'createFederatedModule',
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: [
              'createFederatedModule({',
              '\tname: "${1:moduleName}",',
              '\tfilename: "remoteEntry.js",',
              '\texposes: {',
              '\t\t"./Component": "./src/Component"',
              '\t},',
              '\tshared: {',
              '\t\treact: { singleton: true },',
              '\t\t"react-dom": { singleton: true }',
              '\t}',
              '})'
            ].join('\n'),
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Creates a new federated module configuration'
          },
          {
            label: 'federatedComponent',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: [
              'const ${1:ComponentName} = React.lazy(() => import("${2:remote}/${1:ComponentName}"));',
              '',
              'export default function Wrapped${1:ComponentName}() {',
              '\treturn (',
              '\t\t<React.Suspense fallback={<div>Loading...</div>}>',
              '\t\t\t<${1:ComponentName} />',
              '\t\t</React.Suspense>',
              '\t);',
              '}'
            ].join('\n'),
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Creates a wrapped federated component with Suspense'
          }
        ];
        
        return { suggestions };
      }
    });
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-2 bg-gray-100">
        <Tabs value={activeFile?.path} onValueChange={(path) => {
          const file = files.find(f => f.path === path);
          setActiveFile(file);
        }}>
          <TabList>
            {files.map(file => (
              <Tab key={file.path} value={file.path} className="flex items-center">
                {file.name}
                {isModified && activeFile?.path === file.path && ' •'}
              </Tab>
            ))}
          </TabList>
        </Tabs>
        
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleSave}
            disabled={!isModified}
          >
            <Save className="w-4 h-4 mr-2" />
            Save
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {/* Implement split view */}}
          >
            <Split className="w-4 h-4 mr-2" />
            Split
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {/* Implement preview */}}
          >
            <PlayCircle className="w-4 h-4 mr-2" />
            Preview
          </Button>
        </div>
      </div>

      <div className="flex-1">
        {activeFile && (
          <Editor
            height="100%"
            language={getFileLanguage(activeFile.name)}
            value={editorValue}
            onChange={handleFileChange}
            options={editorOptions}
            beforeMount={setupCustomCompletions}
            theme="vs-dark"
          />
        )}
      </div>
    </div>
  );
};

export default EditorPanel;