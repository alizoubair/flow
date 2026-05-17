import React from 'react';
import { usePipelineStore } from '../../store/pipelineStore';
import './Header.css';

const Header: React.FC = () => {
  const { currentPipeline } = usePipelineStore();

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
              <span className="pipeline-name">{currentPipeline.name}</span>
            </div>
          </>
        )}
      </div>

      <div className="header-right">
      </div>
    </header>
  );
};

export default Header;
