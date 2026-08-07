import { useState } from 'react';
import './App.css';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        src?: string;
        ar?: boolean;
        'ar-modes'?: string;
        'camera-controls'?: boolean;
        'auto-rotate'?: boolean;
      }, HTMLElement>;
    }
  }
}

function App() {
  const [modelUrl, setModelUrl] = useState('');

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '600px', margin: '0 auto', color: '#fff', background: '#121212', minHeight: '100vh' }}>
      <h1>Architect AR Viewer</h1>
      <p style={{ color: '#aaa', fontSize: '14px' }}>Paste your Cloudflare R2 .glb model link below:</p>
      
      <input 
        type="text" 
        placeholder="https://your-bucket.r2.dev/model.glb" 
        value={modelUrl}
        onChange={(e) => setModelUrl(e.target.value)}
        style={{ width: '100%', padding: '12px', marginBottom: '20px', borderRadius: '8px', border: '1px solid #444', background: '#222', color: '#fff', boxSizing: 'border-box' }}
      />

      {modelUrl ? (
        <model-viewer 
          src={modelUrl} 
          ar 
          ar-modes="webxr scene-viewer quick-look" 
          camera-controls 
          auto-rotate 
          style={{ width: '100%', height: '450px', background: '#1e1e1e', borderRadius: '12px' }}
        ></model-viewer>
      ) : (
        <div style={{ padding: '40px', textAlign: 'center', border: '2px dashed #444', borderRadius: '12px', color: '#777' }}>
          Your 3D model will appear here once you paste your link above.
        </div>
      )}
    </div>
  );
}

export default App;
