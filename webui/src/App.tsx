import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, Image as ImageIcon, Layout, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import classNames from 'classnames';
import { uploadVideo, pollStatus, fetchResults, getAssetUrl } from './api';
import type { TaskStatus, TaskResults } from './api';

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [status, setStatus] = useState<TaskStatus | null>(null);
  const [results, setResults] = useState<TaskResults | null>(null);
  const [activeTab, setActiveTab] = useState<'subtitles' | 'markdown' | 'images' | 'html'>('subtitles');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let pollInterval: number;

    const checkStatus = async () => {
      if (!taskId) return;
      try {
        const currentStatus = await pollStatus(taskId);
        setStatus(currentStatus);

        if (currentStatus.state === 'completed') {
          clearInterval(pollInterval);
          const finalResults = await fetchResults(taskId);
          setResults(finalResults);
        } else if (currentStatus.state === 'error') {
          clearInterval(pollInterval);
        }
      } catch (err) {
        console.error('Failed to poll status:', err);
      }
    };

    if (taskId && status?.state !== 'completed' && status?.state !== 'error') {
      pollInterval = setInterval(checkStatus, 2000) as unknown as number;
    }

    return () => clearInterval(pollInterval);
  }, [taskId, status?.state]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type.startsWith('video/')) {
        setFile(droppedFile);
      } else {
        alert("Please upload a video file.");
      }
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    try {
      setStatus({ progress: 0, desc: '上传中...', state: 'processing' });
      setResults(null);

      const newTaskId = await uploadVideo(file);
      setTaskId(newTaskId);
    } catch (err) {
      console.error(err);
      setStatus({ progress: 0, desc: '上传失败', state: 'error' });
    }
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>Clip2Post</h1>
        <p>AI Video to Article Generator</p>
      </header>

      <div className="glass-panel">
        {!taskId || status?.state === 'error' ? (
          <>
            <div
              className={classNames('upload-zone', { 'border-accent-primary transform -translate-y-1': isDragging })}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="upload-icon mx-auto" />
              <div className="upload-text">
                {file ? file.name : 'Click or drag video here'}
              </div>
              <div className="upload-hint">MP4, MOV, MKV up to 500MB</div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="video/*"
                className="hidden"
                style={{ display: 'none' }}
              />
            </div>

            <div style={{ marginTop: '2rem', textAlign: 'center' }}>
              <button
                className="btn-primary"
                onClick={handleUpload}
                disabled={!file}
              >
                Start Processing
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </>
        ) : (
          <div className="progress-container">
            <div className="progress-header">
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {status?.state === 'processing' && <Loader2 className="spinner" size={18} />}
                {status?.state === 'completed' && <CheckCircle2 size={18} color="var(--success-color)" />}
                {(status?.state as any) === 'error' && <AlertCircle size={18} color="#ef4444" />}
                {status?.desc || 'Processing...'}
              </span>
              <span>{Math.round((status?.progress || 0) * 100)}%</span>
            </div>
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{ width: `${(status?.progress || 0) * 100}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>

      {results && (
        <div className="tabs-container">
          <div className="tabs-list">
            <button
              className={classNames('tab-btn', { active: activeTab === 'subtitles' })}
              onClick={() => setActiveTab('subtitles')}
            >
              <FileText size={16} style={{ display: 'inline', marginRight: '6px' }} />
              Subtitles
            </button>
            <button
              className={classNames('tab-btn', { active: activeTab === 'markdown' })}
              onClick={() => setActiveTab('markdown')}
            >
              <FileText size={16} style={{ display: 'inline', marginRight: '6px' }} />
              AI Article
            </button>
            <button
              className={classNames('tab-btn', { active: activeTab === 'images' })}
              onClick={() => setActiveTab('images')}
            >
              <ImageIcon size={16} style={{ display: 'inline', marginRight: '6px' }} />
              Screenshots
            </button>
            <button
              className={classNames('tab-btn', { active: activeTab === 'html' })}
              onClick={() => setActiveTab('html')}
            >
              <Layout size={16} style={{ display: 'inline', marginRight: '6px' }} />
              Final Layout
            </button>
          </div>

          <div className="tab-content">
            {activeTab === 'subtitles' && (
              <textarea
                className="textarea-styled"
                readOnly
                value={results.subtitles || 'No subtitles found.'}
              />
            )}

            {activeTab === 'markdown' && (
              <textarea
                className="textarea-styled"
                readOnly
                value={results.markdown || 'No article generated.'}
              />
            )}

            {activeTab === 'images' && (
              <div className="gallery-grid">
                {results.images && results.images.length > 0 ? (
                  results.images.map((img, i) => (
                    <div key={i} className="gallery-item">
                      <img src={getAssetUrl(img)} alt={`Screenshot ${i + 1}`} />
                    </div>
                  ))
                ) : (
                  <p>No images extracted.</p>
                )}
              </div>
            )}

            {activeTab === 'html' && (
              <div className="iframe-container">
                {results.html_url ? (
                  <iframe
                    src={getAssetUrl(results.html_url)}
                    width="100%"
                    height="100%"
                    style={{ border: 'none', borderRadius: '8px' }}
                    title="Article Preview"
                  />
                ) : (
                  <p style={{ padding: '1rem', color: 'black' }}>Preview not available.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
