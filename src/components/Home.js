// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import React, { useState, useRef, useEffect } from "react";
import "./Home.css";
import VideoPlayer from "./playerjs/";
import { deploymentConfig } from "../deployment-config";

export default function Home(props) {
  const { username, token } = props;
  const playerRef = useRef(null);

  // Use deployment config for default video URL, fallback to demo URL
  const defaultVideoURL = deploymentConfig?.cloudfront?.demoVideoUrl || 
    "https://daq51dk8vsgt8.cloudfront.net/big_buck_bunny.m3u8";

  const [videoURL, setVideoURL] = useState(defaultVideoURL);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playerStatus, setPlayerStatus] = useState('ready');
  const [playerError, setPlayerError] = useState(null);
  const [debugInfo, setDebugInfo] = useState({
    responseCode: null,
    responseHeaders: {},
    loadTime: null,
    error: null,
    lastChecked: null
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
      // Check the URL the same way the video player does - with token as query parameter
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

      setDebugInfo({
        responseCode: response.status,
        responseHeaders: headers,
        loadTime: loadTime,
        error: response.ok ? null : response.statusText,
        lastChecked: new Date().toLocaleTimeString()
      });
    } catch (error) {
      const loadTime = Date.now() - startTime;
      setDebugInfo({
        responseCode: 'failed',
        responseHeaders: {},
        loadTime: loadTime,
        error: error.message,
        lastChecked: new Date().toLocaleTimeString()
      });
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
    playerRef.current = player;
  };

  const handlePlay = (e) => {
    e.preventDefault();
    if (playerRef.current) {
      playerRef.current.src(videoURL);
      setIsPlaying(true);
    }
  };

  // Update video options when token changes
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

                {playerError && (
                  <div className="mb-2">
                    <small><strong>Player Error:</strong> <span className="text-danger">{playerError}</span></small>
                  </div>
                )}

                <div className="mb-2">
                  <small><strong>CloudFront:</strong> {deploymentConfig?.cloudfront?.distributionUrl || videoURL.split('/')[0] + '//' + videoURL.split('/')[2]}</small>
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

          </div>
        </div>
      </div>
    </div>
  );
}
