import React, { useState, useRef, useEffect } from 'react';
import { usePipelineStore } from '../../store/pipelineStore';
import './Header.css';

const Header: React.FC = () => {
  const { currentPipeline, hasUnsavedChanges, updatePipelineName } = usePipelineStore();
  const [isEditingName, setIsEditingName] = useState(false);
  const [pipelineName, setPipelineName] = useState(currentPipeline?.name || '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingName && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingName]);

  const getSaveStatus = () => {
    if (hasUnsavedChanges) return 'Saving...';
    if (!currentPipeline?.lastSaved) return 'All changes saved';

    const now = new Date();
    const diff = Math.floor((now.getTime() - currentPipeline.lastSaved.getTime()) / 1000);

    if (diff < 10) return 'All changes saved';
    if (diff < 3600) return `Saved ${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `Saved ${Math.floor(diff / 3600)}h ago`;
    return `Saved ${Math.floor(diff / 86400)}d ago`;
  };

  const handleNameSubmit = () => {
    if (pipelineName.trim()) {
      updatePipelineName(pipelineName.trim());
    }
    setIsEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameSubmit();
    } else if (e.key === 'Escape') {
      setPipelineName(currentPipeline?.name || '');
      setIsEditingName(false);
    }
  };

  return (
    <header className="header">
      <div className="header-left">
        <div className="header-logo">
          <h1 className="logo-text">Flow</h1>
        </div>
        {currentPipeline && (
          <>
            <div className="header-divider"></div>
            <div className="pipeline-info">
              {isEditingName ? (
                <input
                  ref={inputRef}
                  type="text"
                  className="pipeline-name-input"
                  value={pipelineName}
                  onChange={(e) => setPipelineName(e.target.value)}
                  onBlur={handleNameSubmit}
                  onKeyDown={handleNameKeyDown}
                  placeholder="Enter pipeline name"
                />
              ) : (
                <span
                  className="pipeline-name editable"
                  onClick={() => {
                    setIsEditingName(true);
                    setPipelineName(currentPipeline.name);
                  }}
                >
                  {currentPipeline.name}
                </span>
              )}
              <span className={`save-status ${hasUnsavedChanges ? 'saving' : 'saved'}`}>
                {hasUnsavedChanges && <span className="saving-dot"></span>}
                {getSaveStatus()}
              </span>
            </div>
          </>
        )}
      </div>

      <div className="header-right">
        {/* Clean header - no buttons needed */}
      </div>
    </header>
  );
};

export default Header;
