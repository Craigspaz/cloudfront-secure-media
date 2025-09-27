// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import React, { useState, useRef, useEffect } from "react";
import "./Home.css";
import VideoPlayer from "./playerjs/";
import DebugPanel from "./DebugPanel";
import { deploymentConfig } from "../deployment-config";

export default function Home(props) {
  const { username, token } = props;
  const playerRef = useRef(null);

  const defaultVideoURL = deploymentConfig?.cloudfront?.demoVideoUrl || 
    "https://daq51dk8vsgt8.cloudfront.net/big_buck_bunny.m3u8";

  const [videoURL, setVideoURL] = useState(defaultVideoURL);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playerStatus, setPlayerStatus] = useState('ready');
  const [playerError, setPlayerError] = useState(null);
  const [stats, setStats] = useState({
    buffer: [],
    bandwidth: [],
    currentBitrate: 0,
    droppedFrames: 0
  });
  const [debugInfo, setDebugInfo] = useState({
    responseCode: null,
    responseHeaders: {},
    loadTime: null,
    error: null,
    lastChecked: null,
    cloudFrontUrl: deploymentConfig?.cloudfront?.distributionUrl || videoURL.split('/')[0] + '//' + videoURL.split('/')[2]
  });

  const videoJsOptions = {
    autoplay: true,
    controls: true,
    responsive: true,
    fluid: true,
    width: "100%",
    height: 500,
    token: token,
    sources: [
      {
        src: videoURL,
        type: "application/x-mpegURL",
      },
    ],
  };

  const checkVideoURL = async (url) => {
    const startTime = Date.now();
    setDebugInfo(prev => ({ ...prev, responseCode: 'checking...' }));
    
    try {
      const urlWithToken = token ? `${url}?token=${token}` : url;
      const response = await fetch(urlWithToken, { 
        method: 'GET',
        mode: 'cors'
      });
      
      const loadTime = Date.now() - startTime;
      const headers = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      setDebugInfo(prev => ({
        ...prev,
        responseCode: response.status,
        responseHeaders: headers,
        loadTime: loadTime,
        error: response.ok ? null : response.statusText,
        lastChecked: new Date().toLocaleTimeString()
      }));
    } catch (error) {
      const loadTime = Date.now() - startTime;
      setDebugInfo(prev => ({
        ...prev,
        responseCode: 'failed',
        responseHeaders: {},
        loadTime: loadTime,
        error: error.message,
        lastChecked: new Date().toLocaleTimeString()
      }));
    }
  };

  useEffect(() => {
    if (videoURL) {
      checkVideoURL(videoURL);
    }
  }, [videoURL, token]);

  const handlePlayerReady = (player) => {
    player.on("play", () => {
      setIsPlaying(true);
      setPlayerStatus('playing');
      setPlayerError(null);
    });
    player.on("pause", () => {
      setIsPlaying(false);
      setPlayerStatus('paused');
    });
    player.on("ended", () => {
      setIsPlaying(false);
      setPlayerStatus('ended');
    });
    player.on("error", (e) => {
      setIsPlaying(false);
      setPlayerStatus('error');
      const error = player.error();
      setPlayerError(error ? `${error.code}: ${error.message}` : 'Unknown error');
    });
    player.on("loadstart", () => {
      setPlayerStatus('loading');
      setPlayerError(null);
    });
    player.on("canplay", () => {
      setPlayerStatus('ready');
    });
    
    // Fixed stats collection
    const updateStats = () => {
      if (player && !player.isDisposed()) {
        try {
          const buffered = player.buffered();
          const currentTime = player.currentTime();
          
          let bufferLevel = 0;
          if (buffered.length > 0) {
            for (let i = 0; i < buffered.length; i++) {
              if (currentTime >= buffered.start(i) && currentTime <= buffered.end(i)) {
                bufferLevel = buffered.end(i) - currentTime;
                break;
              }
            }
          }
          
          // Fixed bitrate collection
          let bandwidth = 0;
          let currentBitrate = 0;
          
          if (player.tech() && player.tech().vhs) {
            const vhs = player.tech().vhs;
            bandwidth = vhs.bandwidth || 0;
            
            // Get actual current bitrate from active playlist
            if (vhs.playlists && vhs.playlists.media()) {
              const media = vhs.playlists.media();
              currentBitrate = media.attributes?.BANDWIDTH || 0;
            }
            
            // Fallback: try to get from stats
            if (!currentBitrate && vhs.stats && vhs.stats.bandwidth) {
              currentBitrate = vhs.stats.bandwidth;
            }
          }
          
          setStats(prev => ({
            buffer: [...prev.buffer.slice(-19), bufferLevel],
            bandwidth: [...prev.bandwidth.slice(-19), bandwidth / 1000],
            currentBitrate: currentBitrate / 1000,
            droppedFrames: 0
          }));
        } catch (error) {
          console.log('Stats update error:', error);
        }
      }
    };
    
    const statsInterval = setInterval(updateStats, 1000);
    player.on('dispose', () => clearInterval(statsInterval));
    
    playerRef.current = player;
  };

  const handlePlay = (e) => {
    e.preventDefault();
    if (playerRef.current) {
      playerRef.current.src(videoURL);
      setIsPlaying(true);
    }
  };

  useEffect(() => {
    if (playerRef.current && token) {
      playerRef.current.token = token;
    }
  }, [token]);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="page-background">
      <div className="container-fluid py-4">
        <div className="row justify-content-center">
          <div className="col-lg-10 col-xl-8">
            
            {/* Video Player Section */}
            <div className="card shadow-lg mb-4 video-card">
              <div className="card-body p-0">
                <VideoPlayer
                  options={videoJsOptions}
                  onReady={handlePlayerReady}
                />
              </div>
            </div>

            {/* Controls Section */}
            <div className="card shadow-lg mb-4 control-card">
              <div className="card-header text-white card-header-gradient">
                <h5 className="mb-0">🎬 Video Controls</h5>
              </div>
              <div className="card-body">
                <form onSubmit={handlePlay}>
                  <div className="row g-3 align-items-end">
                    <div className="col-md-8">
                      <label className="form-label">Video URL (HLS Stream)</label>
                      <input
                        type="url"
                        className="form-control input-rounded"
                        value={videoURL}
                        onChange={(e) => setVideoURL(e.target.value)}
                        placeholder="Enter HLS video URL..."
                      />
                    </div>
                    <div className="col-md-4">
                      <button type="submit" className="btn text-white w-100 btn-gradient">
                        {isPlaying ? "🔄 Change Video" : "▶️ Play Video"}
                      </button>
                    </div>
                  </div>
                </form>
                <div className="form-text">
                  Demo video is automatically loaded. You can enter your own HLS video URL above.
                </div>
                <div className="alert alert-info mt-3" style={{borderRadius: '8px', fontSize: '14px'}}>
                  <strong>Note:</strong> CloudFront distribution must be fully deployed before video streaming works. 
                  Check deployment status with: <br/>
                  <code>aws cloudfront get-distribution --id &lt;DISTRIBUTION_ID&gt; --query 'Distribution.Status' --output text</code><br/>
                  Status should show "Deployed" (not "InProgress").
                </div>
              </div>
            </div>

            {/* Debug Info Section */}
            <DebugPanel 
              username={username}
              playerStatus={playerStatus}
              isPlaying={isPlaying}
              playerError={playerError}
              debugInfo={debugInfo}
              stats={stats}
              token={token}
              copyToClipboard={copyToClipboard}
            />

          </div>
        </div>
      </div>
    </div>
  );
}
