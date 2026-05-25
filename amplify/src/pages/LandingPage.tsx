import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileUp, Plus, AlertCircle, LogIn } from 'lucide-react';
import './LandingPage.css';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCreateNew = () => {
    navigate('/pipelines');
  };

  const handleLoadFile = () => {
    fileInputRef.current?.click();
  };

  const handleSignIn = () => {
    navigate('/login');
  };

  const handleSignUp = () => {
    navigate('/signup');
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        JSON.parse(content); // Validate JSON format

        // Store the loaded pipeline data
        localStorage.setItem('flow-imported-pipeline', content);

        // Navigate to canvas
        navigate('/pipelines');
      } catch (error) {
        alert('Failed to load file. Please ensure it is a valid Flow pipeline file.');
        console.error('Error loading file:', error);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="landing-page">
      {/* Auth buttons */}
      <div className="landing-auth">
        <button className="auth-link" onClick={handleSignIn}>
          <LogIn size={16} />
          <span>Sign In</span>
        </button>
        <button className="auth-btn" onClick={handleSignUp}>
          Sign Up
        </button>
      </div>

      {/* Centered content */}
      <div className="landing-center">
        <div className="landing-content">
          <div className="landing-header">
            <h1 className="landing-title">Flow</h1>
            <p className="landing-subtitle">
              A low-code tool for creating and configuring interactive CI/CD pipelines
            </p>
          </div>


          {/* Action buttons */}
          <div className="landing-actions">
            <button className="landing-btn primary" onClick={handleCreateNew}>
              <Plus size={20} />
              <span>Create New Pipeline</span>
            </button>
            <button className="landing-btn secondary" onClick={handleLoadFile}>
              <FileUp size={20} />
              <span>Open from File</span>
            </button>
          </div>

          {/* Storage warning */}
          <div className="landing-note">
            <AlertCircle size={14} />
            <p>
              No sign-up required. Start building immediately. Your work is saved in browser storage.
            </p>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.flow"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
    </div>
  );
};

export default LandingPage;
