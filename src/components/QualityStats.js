import React from 'react';

const QualityStats = ({ stats }) => {
  return (
    <div className="mb-2">
      <div className="row g-2">
        <div className="col-6">
          <small><strong>Buffer:</strong> {stats.buffer.length > 0 ? `${stats.buffer[stats.buffer.length - 1]?.toFixed(1)}s` : '0s'}</small>
          <div className="bg-light position-relative" style={{height: '60px', borderRadius: '3px', overflow: 'hidden'}}>
            <svg width="100%" height="60" style={{position: 'absolute'}}>
              <defs>
                <pattern id="bufferGrid" width="10" height="10" patternUnits="userSpaceOnUse">
                  <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#e0e0e0" strokeWidth="0.5"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#bufferGrid)" />
              
              <line x1="0" y1="15" x2="100%" y2="15" stroke="#ccc" strokeWidth="1" strokeDasharray="2,2" />
              <line x1="0" y1="30" x2="100%" y2="30" stroke="#ccc" strokeWidth="1" strokeDasharray="2,2" />
              <line x1="0" y1="45" x2="100%" y2="45" stroke="#ccc" strokeWidth="1" strokeDasharray="2,2" />
              
              <polyline
                fill="none"
                stroke="#28a745"
                strokeWidth="2"
                points={stats.buffer.map((val, i) => 
                  `${(i / Math.max(stats.buffer.length - 1, 1)) * 100},${60 - Math.min((val / 10) * 60, 60)}`
                ).join(' ')}
              />
            </svg>
          </div>
        </div>
        <div className="col-6">
          <small><strong>Bitrate:</strong> {stats.currentBitrate ? `${stats.currentBitrate.toFixed(0)}k` : '0k'}</small>
          <div className="bg-light position-relative" style={{height: '60px', borderRadius: '3px', overflow: 'hidden'}}>
            <svg width="100%" height="60" style={{position: 'absolute'}}>
              <defs>
                <pattern id="bitrateGrid" width="10" height="10" patternUnits="userSpaceOnUse">
                  <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#e0e0e0" strokeWidth="0.5"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#bitrateGrid)" />
              
              <line x1="0" y1="15" x2="100%" y2="15" stroke="#ccc" strokeWidth="1" strokeDasharray="2,2" />
              <line x1="0" y1="30" x2="100%" y2="30" stroke="#ccc" strokeWidth="1" strokeDasharray="2,2" />
              <line x1="0" y1="45" x2="100%" y2="45" stroke="#ccc" strokeWidth="1" strokeDasharray="2,2" />
              
              <polyline
                fill="none"
                stroke="#007bff"
                strokeWidth="2"
                points={stats.bandwidth.map((val, i) => {
                  const maxBandwidth = Math.max(...stats.bandwidth, 1000);
                  return `${(i / Math.max(stats.bandwidth.length - 1, 1)) * 100},${60 - (val / maxBandwidth) * 60}`;
                }).join(' ')}
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QualityStats;
