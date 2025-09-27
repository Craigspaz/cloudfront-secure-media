import React from 'react';
import QualityStats from './QualityStats';

const DebugPanel = ({ username, playerStatus, isPlaying, playerError, debugInfo, stats, token, copyToClipboard }) => {
  return (
    <div className="card shadow-lg control-card">
      <div className="card-header text-white d-flex justify-content-between card-header-gradient">
        <h6 className="mb-0">🔍 Debug Info</h6>
        <small>User: {username}</small>
      </div>
      <div className="card-body p-3 debug-content">
        <div className="mb-2">
          <span className={`badge ${isPlaying ? 'bg-success' : 'bg-secondary'} me-2`}>
            {playerStatus}
          </span>
          <span className="badge bg-light text-dark me-2">
            {debugInfo.responseCode}
          </span>
          <small>{debugInfo.loadTime ? `${debugInfo.loadTime}ms` : 'N/A'}</small>
        </div>

        <QualityStats stats={stats} />

        {playerError && (
          <div className="mb-2">
            <small><strong>Player Error:</strong> <span className="text-danger">{playerError}</span></small>
          </div>
        )}

        <div className="mb-2">
          <small><strong>CloudFront:</strong> {debugInfo.cloudFrontUrl || 'N/A'}</small>
        </div>

        {debugInfo.error && (
          <div className="mb-2">
            <small><strong>Error:</strong> <span className="text-danger">{debugInfo.error}</span></small>
          </div>
        )}

        <details className="mb-2">
          <summary><small><strong>Headers</strong></small></summary>
          <div className="bg-light p-1 mt-1 headers-container">
            {Object.keys(debugInfo.responseHeaders).length > 0 ? 
              Object.entries(debugInfo.responseHeaders).map(([key, value]) => (
                <div key={key}><strong>{key}:</strong> {value}</div>
              )) : 'No headers'
            }
          </div>
        </details>

        <div>
          <div className="d-flex justify-content-between mb-1">
            <small><strong>JWT Token</strong></small>
            <button 
              className="btn btn-sm text-white btn-gradient-sm"
              onClick={() => copyToClipboard(token)}
            >
              📋
            </button>
          </div>
          <div className="bg-light p-1 token-container">
            {token || "No token"}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DebugPanel;
