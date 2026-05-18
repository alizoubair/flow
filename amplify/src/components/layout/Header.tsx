import React, { useState, useRef, useEffect } from 'react';
import { usePipelineStore } from '../../store/pipelineStore';
import { Menu, RotateCcw, AlertTriangle } from 'lucide-react';
import './Header.css';

const Header: React.FC = () => {
  const { currentPipeline, hasUnsavedChanges, updatePipelineName, resetCanvas } = usePipelineStore();
  const [isEditingName, setIsEditingName] = useState(false);
  const [pipelineName, setPipelineName] = useState(currentPipeline?.name || '');
  const [showMenu, setShowMenu] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
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

  const handleResetCanvas = () => {
    setShowMenu(false);
    setShowResetModal(true);
  };

  const confirmReset = () => {
    resetCanvas();
    setShowResetModal(false);
  };

  return (
    <header className="header">
      <div className="header-left">
        <div className="hamburger-menu">
          <button
            className="hamburger-button"
            onClick={() => setShowMenu(!showMenu)}
            aria-label="Menu"
          >
            <Menu size={20} />
          </button>

          {showMenu && (
            <>
              <div className="menu-overlay" onClick={() => setShowMenu(false)} />
              <div className="hamburger-dropdown">
                <button className="menu-item" onClick={handleResetCanvas}>
                  <RotateCcw size={16} />
                  <span>Reset Canvas</span>
                </button>
              </div>
            </>
          )}
        </div>

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
        {/* Future: Theme toggle, Settings */}
      </div>

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div className="modal-overlay" onClick={() => setShowResetModal(false)}>
          <div className="reset-modal" onClick={(e) => e.stopPropagation()}>
            <div className="reset-modal-icon">
              <AlertTriangle size={24} />
            </div>
            <h3 className="reset-modal-title">Reset Canvas?</h3>
            <p className="reset-modal-description">
              This will clear all stages, tasks, and connections from your canvas. This action cannot be undone.
            </p>
            <div className="reset-modal-actions">
              <button
                className="reset-modal-button cancel"
                onClick={() => setShowResetModal(false)}
              >
                Cancel
              </button>
              <button
                className="reset-modal-button confirm"
                onClick={confirmReset}
              >
                Reset Canvas
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
