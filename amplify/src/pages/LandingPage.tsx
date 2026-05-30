import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import Header from '../components/layout/Header';
import './LandingPage.css';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  const handleNewPipeline = () => {
    navigate('/canvas');
  };

  return (
    <div className="landing-page">
      <Header />

      {/* Hero Section */}
      <main className="landing-main">
        <div className="landing-hero">
          <h1 className="landing-hero-title">
            Build workflows visually
          </h1>
          <p className="landing-hero-subtitle">
            Design, visualize, and automate your CI/CD pipelines with an intuitive drag-and-drop canvas
          </p>
          <button className="landing-cta" onClick={handleNewPipeline}>
            <Plus size={20} strokeWidth={2.5} />
            <span>New Pipeline</span>
          </button>
          <p className="landing-notice">
            No sign-up required — start building immediately
          </p>
        </div>
      </main>
    </div>
  );
};

export default LandingPage;
