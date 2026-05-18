import React, { useState, useRef, useEffect } from 'react';
import { usePipelineStore } from '../../store/pipelineStore';
import { Menu, RotateCcw, AlertTriangle, Sun, Moon } from 'lucide-react';
import './Header.css';

const Header: React.FC = () => {
  const {
    currentPipeline,
    hasUnsavedChanges,
    updatePipelineName,
    resetCanvas,
    theme,
    canvasBackground,
    canvasBackgroundColor,
    setTheme,
    setCanvasBackground,
    setCanvasBackgroundColor
  } = usePipelineStore();
  const [isEditingName, setIsEditingName] = useState(false);
  const [pipelineName, setPipelineName] = useState(currentPipeline?.name || '');
  const [showMenu, setShowMenu] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingName && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingName]);

  // Update current time every 10 seconds to refresh save status
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, []);

  const getSaveStatus = () => {
    if (hasUnsavedChanges) return 'Saving...';
    if (!currentPipeline?.lastSaved) return 'Not saved yet';

    const diff = Math.floor((currentTime - currentPipeline.lastSaved.getTime()) / 1000);

    if (diff < 10) return 'Just saved';
    if (diff < 60) return `Saved ${diff}s ago`;
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
                {/* Canvas Background */}
                <div className="menu-section">
                  <div className="menu-section-label">Canvas</div>
                  <div className="menu-group">
                    <div className="menu-item-label">Background</div>
                    <div className="option-group">
                      {(['dots', 'lines', 'grid', 'none'] as const).map((bg) => (
                        <button
                          key={bg}
                          className={`option-button ${canvasBackground === bg ? 'active' : ''}`}
                          onClick={() => setCanvasBackground(bg)}
                        >
                          {bg.charAt(0).toUpperCase() + bg.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="menu-group">
                    <div className="menu-item-label">Background Color</div>
                    <div className="color-picker-grid">
                      {[
                        { color: '#F7F8FA', label: 'Light Gray' },
                        { color: '#FFFFFF', label: 'White' },
                        { color: '#FEF3C7', label: 'Light Yellow' },
                        { color: '#DBEAFE', label: 'Light Blue' },
                        { color: '#D1FAE5', label: 'Light Green' },
                        { color: '#FCE7F3', label: 'Light Pink' },
                        { color: '#E0E7FF', label: 'Light Indigo' },
                        { color: '#1e1e1e', label: 'Dark' },
                      ].map(({ color, label }) => (
                        <button
                          key={color}
                          className={`color-option ${canvasBackgroundColor === color ? 'active' : ''}`}
                          style={{ backgroundColor: color }}
                          onClick={() => setCanvasBackgroundColor(color)}
                          title={label}
                          aria-label={label}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="menu-divider"></div>

                {/* Theme */}
                <div className="menu-section">
                  <div className="menu-section-label">Appearance</div>
                  <div className="menu-group">
                    <div className="menu-item-label">Theme</div>
                    <div className="option-group">
                      <button
                        className={`option-button ${theme === 'light' ? 'active' : ''}`}
                        onClick={() => setTheme('light')}
                      >
                        <Sun size={14} />
                        Light
                      </button>
                      <button
                        className={`option-button ${theme === 'dark' ? 'active' : ''}`}
                        onClick={() => setTheme('dark')}
                      >
                        <Moon size={14} />
                        Dark
                      </button>
                    </div>
                  </div>
                </div>

                <div className="menu-divider"></div>

                {/* Actions */}
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
        {/* Empty - all controls in hamburger menu */}
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
