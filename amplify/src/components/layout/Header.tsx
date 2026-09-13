import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { usePipelineStore } from '../../store/pipelineStore';
import { pipelineApi } from '../../services/api';
import { authService } from '../../services/auth';
import {
  Menu, RotateCcw, AlertTriangle, Sun, Moon, LogOut, LogIn,
  UserPlus, Settings, GitBranch,
  Trash2, Copy, Plus, PenLine, Check, Loader, X
} from 'lucide-react';
import './Header.css';

const Header: React.FC = () => {
  const navigate = useNavigate();
  const { pipelineId } = useParams<{ pipelineId: string }>();
  const {
    currentPipeline,
    hasUnsavedChanges,
    saveStatus,
    updatePipelineName,
    resetCanvas,
    deletePipeline,
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
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showPipelineSettings, setShowPipelineSettings] = useState(false);
  const [showPipelinesList, setShowPipelinesList] = useState(false);
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [loadingPipelines, setLoadingPipelines] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const inputRef = useRef<HTMLInputElement>(null);

  // Get user from localStorage
  const getUserFromStorage = () => {
    const userStr = localStorage.getItem('flow-user');
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch {
        return null;
      }
    }
    return null;
  };

  const [user, setUser] = useState(getUserFromStorage());

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

  // Fetch pipelines when dropdown opens
  useEffect(() => {
    if (showPipelinesList && authService.isAuthenticated()) {
      setLoadingPipelines(true);
      pipelineApi.list()
        .then(response => {
          setPipelines(response.pipelines || []);
        })
        .catch(err => {
          console.error('Failed to load pipelines:', err);
          setPipelines([]);
        })
        .finally(() => {
          setLoadingPipelines(false);
        });
    }
  }, [showPipelinesList]);

  const getSaveStatus = () => {
    if (saveStatus === 'saving') return 'Saving...';
    if (saveStatus === 'error') return 'Save failed — retrying';
    if (saveStatus === 'local') return 'Saved locally';
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

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      await deletePipeline();
      setShowDeleteModal(false);
      navigate('/canvas');
    } catch (err) {
      console.error('Failed to delete pipeline:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLogout = () => {
    // Clear user data from localStorage
    localStorage.removeItem('flow-user');
    localStorage.removeItem('flow-access-token');
    localStorage.removeItem('flow-refresh-token');
    localStorage.removeItem('flow-autosave');

    // Clear pipeline state
    resetCanvas();

    // Close profile menu
    setShowProfileMenu(false);

    // Navigate to landing page
    navigate('/');
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

                <div className="menu-divider"></div>

                <a
                  href="https://github.com/alizoubair/flow"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="menu-item"
                  onClick={() => setShowMenu(false)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.866-.013-1.7-2.782.603-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.463-1.11-1.463-.908-.62.069-.607.069-.607 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
                  </svg>
                  <span>GitHub</span>
                </a>
              </div>
            </>
          )}
        </div>

        <div className="header-logo">
          <img src="/flow-icon.png" alt="Flow" className="logo-icon" />
          <h1 className="logo-text">Flow</h1>
        </div>
        {pipelineId && currentPipeline && (
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

              {/* Pipeline settings icon */}
              <div className="pipeline-info-divider" />
              <div className="pipeline-icon-menu">
                <button
                  className={`pipeline-icon-btn ${showPipelineSettings ? 'active' : ''}`}
                  onClick={() => { setShowPipelineSettings(p => !p); setShowPipelinesList(false); }}
                  aria-label="Pipeline settings"
                  title="Pipeline settings"
                >
                  <Settings size={14} />
                </button>
                {showPipelineSettings && (
                  <>
                    <div className="menu-overlay" onClick={() => setShowPipelineSettings(false)} />
                    <div className="pipeline-dropdown">
                      <button className="pipeline-dropdown-item" onClick={() => {
                        setShowPipelineSettings(false);
                        setIsEditingName(true);
                        setPipelineName(currentPipeline.name);
                      }}>
                        <PenLine size={14} />
                        <span>Rename</span>
                      </button>
                      <button className="pipeline-dropdown-item" onClick={() => setShowPipelineSettings(false)}>
                        <Copy size={14} />
                        <span>Duplicate</span>
                      </button>
                      <div className="menu-divider" />
                      <button className="pipeline-dropdown-item danger" onClick={() => {
                        setShowPipelineSettings(false);
                        setDeleteConfirmText('');
                        setShowDeleteModal(true);
                      }}>
                        <Trash2 size={14} />
                        <span>Delete pipeline</span>
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Pipelines switcher icon */}
              <div className="pipeline-icon-menu">
                <button
                  className={`pipeline-icon-btn ${showPipelinesList ? 'active' : ''}`}
                  onClick={() => { setShowPipelinesList(p => !p); setShowPipelineSettings(false); }}
                  aria-label="My pipelines"
                  title="My pipelines"
                >
                  <GitBranch size={14} />
                </button>
                {showPipelinesList && (
                  <>
                    <div className="menu-overlay" onClick={() => setShowPipelinesList(false)} />
                    <div className="pipeline-dropdown pipelines-list">
                      <div className="pipeline-dropdown-header">My Pipelines</div>
                      {loadingPipelines ? (
                        <div className="pipeline-dropdown-item" style={{ justifyContent: 'center' }}>
                          <Loader size={14} className="spin" />
                          <span>Loading...</span>
                        </div>
                      ) : pipelines.length > 0 ? (
                        pipelines.map(p => (
                          <div
                            key={p.id}
                            className={`pipeline-dropdown-item ${p.id === usePipelineStore.getState().pipelineId ? 'active-pipeline' : ''}`}
                            onClick={() => {
                              setShowPipelinesList(false);
                              navigate(`/canvas/pipelines/${p.id}`);
                            }}
                            style={{ cursor: 'pointer' }}
                          >
                            {p.id === usePipelineStore.getState().pipelineId && <span className="pipeline-active-dot" />}
                            <span className="pipeline-list-name">{p.name}</span>
                            <span className="pipeline-list-time">{new Date(p.updatedAt).toLocaleDateString()}</span>
                          </div>
                        ))
                      ) : (
                        <div className="pipeline-dropdown-item" style={{ justifyContent: 'center', color: '#888' }}>
                          <span>No pipelines yet</span>
                        </div>
                      )}
                      <div className="menu-divider" />
                      <button className="pipeline-dropdown-item" onClick={() => {
                        setShowPipelinesList(false);
                        navigate('/');
                      }}>
                        <Plus size={14} />
                        <span>New Pipeline</span>
                      </button>
                    </div>
                  </>
                )}
              </div>

              <span className={`save-status ${saveStatus === 'saving' ? 'saving' : saveStatus === 'error' ? 'error' : 'saved'}`} style={{ marginLeft: 8 }}>
                {saveStatus === 'saving' && <span className="saving-dot"></span>}
                {getSaveStatus()}
              </span>
            </div>
          </>
        )}
      </div>

      <div className="header-right">
        {user ? (
          /* Profile Menu - Show if user is logged in */
          <div className="profile-menu">
            <button
              className="profile-button"
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              aria-label="Profile menu"
            >
              {user.avatar ? (
                <img src={user.avatar} alt={user.name} className="profile-avatar" />
              ) : (
                <div className="profile-avatar-placeholder">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
            </button>

            {showProfileMenu && (
              <>
                <div className="menu-overlay" onClick={() => setShowProfileMenu(false)} />
                <div className="profile-dropdown">
                  <div className="profile-dropdown-header">
                    <div className="profile-avatar-large">
                      {user.avatar ? (
                        <img src={user.avatar} alt={user.name} />
                      ) : (
                        <span>{user.name.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="profile-info">
                      <div className="profile-name">{user.name}</div>
                      <div className="profile-email">{user.email}</div>
                    </div>
                  </div>

                  <div className="menu-divider"></div>

                  <button className="menu-item" onClick={handleLogout}>
                    <LogOut size={16} />
                    <span>Sign Out</span>
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          /* Auth buttons - Show if user is not logged in */
          <div className="header-auth-buttons">
            <button className="header-auth-btn secondary" onClick={() => navigate('/login')}>
              <LogIn size={16} />
              Sign In
            </button>
            <button className="header-auth-btn primary" onClick={() => navigate('/signup')}>
              <UserPlus size={16} />
              Sign Up
            </button>
          </div>
        )}
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
      {/* Delete Pipeline Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => !isDeleting && setShowDeleteModal(false)}>
          <div className="delete-modal" onClick={(e) => e.stopPropagation()}>

            {/* Header */}
            <div className="delete-modal-header">
              <div className="delete-modal-icon">
                <Trash2 size={18} />
              </div>
              <div>
                <h3 className="delete-modal-title">Delete pipeline</h3>
                <p className="delete-modal-subtitle">{currentPipeline?.name}</p>
              </div>
            </div>

            {/* Warning */}
            <div className="delete-modal-warning">
              <AlertTriangle size={14} />
              <span>This action is permanent and cannot be undone. All stages, tasks and connections will be lost.</span>
            </div>

            {/* Confirm input */}
            <div className="delete-modal-confirm-field">
              <label className="delete-modal-label">
                Type <span className="delete-modal-name-hint">{currentPipeline?.name}</span> to confirm
              </label>
              <div className="delete-modal-input-wrap">
                <input
                  className={`delete-modal-input ${
                    deleteConfirmText.length > 0
                      ? deleteConfirmText === currentPipeline?.name
                        ? 'match'
                        : 'no-match'
                      : ''
                  }`}
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Type pipeline name..."
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && deleteConfirmText === currentPipeline?.name) confirmDelete();
                    if (e.key === 'Escape') setShowDeleteModal(false);
                  }}
                />
                {deleteConfirmText.length > 0 && (
                  <div className={`delete-modal-input-indicator ${deleteConfirmText === currentPipeline?.name ? 'match' : 'no-match'}`}>
                    {deleteConfirmText === currentPipeline?.name
                      ? <Check size={13} />
                      : <X size={13} />
                    }
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="delete-modal-actions">
              <button
                className="delete-modal-cancel"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                className="delete-modal-confirm-btn"
                onClick={confirmDelete}
                disabled={isDeleting || deleteConfirmText !== currentPipeline?.name}
              >
                {isDeleting
                  ? <><Loader size={13} className="spin" /> Deleting…</>
                  : <><Trash2 size={13} /> Delete Pipeline</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
