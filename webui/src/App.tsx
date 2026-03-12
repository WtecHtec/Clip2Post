import { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { uploadVideo, pollStatus, fetchResults, fetchTasks, generateTTSVideo } from './api';
import type { TaskStatus, TaskResults, UploadOptions, TaskOverview, TTSOptions } from './api';

import { Sidebar } from './components/Sidebar';
import { UploadForm } from './components/UploadForm';
import { TTSVideoForm } from './components/TTSVideoForm';
import { ResultsDisplay } from './components/ResultsDisplay';
import type { LLMSettings } from './components/SettingsPanel';

function App() {
  const [workflowMode, setWorkflowMode] = useState<'video-to-post' | 'text-to-video'>('video-to-post');
  const [tasks, setTasks] = useState<TaskOverview[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [status, setStatus] = useState<TaskStatus | any>(null);
  const [results, setResults] = useState<TaskResults | null>(null);
  const [activeTab, setActiveTab] = useState<'subtitles' | 'markdown' | 'images' | 'html' | 'videos' | 'audio' | 'source' | 'recreate'>('subtitles');
  const [isDragging, setIsDragging] = useState(false);

  // Upload options (managed here or passed to UploadForm, keeping top-level state is okay for easy pass down)
  const [asrEngine, setAsrEngine] = useState("funasr");
  const [extractClips, setExtractClips] = useState(false);
  const [addOverlay, setAddOverlay] = useState(false);
  const [generateArticle, setGenerateArticle] = useState(true);
  const [generateImages, setGenerateImages] = useState(true);
  const [generateHtml, setGenerateHtml] = useState(true);
  const [customPrompt, setCustomPrompt] = useState("");

  const [llmSettings, setLlmSettings] = useState<LLMSettings>({ apiKey: '', baseUrl: '', model: '' });
  const [reGenerateOptions, setReGenerateOptions] = useState<Partial<TTSOptions> | null>(null);

  const loadTasks = async () => {
    try {
      const fetchedTasks = await fetchTasks();
      setTasks(fetchedTasks);
    } catch (err) {
      console.error("Failed to load tasks", err);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const selectTask = async (id: string) => {
    setTaskId(id);
    setFile(null); // Clear pending upload
    setVideoUrl(''); // Clear pending URL
    setStatus({ progress: 1, desc: '加载中...', state: 'processing' });
    try {
      const currentStatus = await pollStatus(id);
      setStatus(currentStatus);
      if (currentStatus.state === 'completed') {
        const finalResults = await fetchResults(id);
        setResults(finalResults);
      } else {
        setResults(null);
      }
    } catch (err) {
      console.error(err);
      setStatus({ progress: 0, desc: '无法加载任务状态', state: 'error' });
    }
  };

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
          loadTasks(); // refresh task list
        } else if (currentStatus.state === 'error') {
          clearInterval(pollInterval);
          loadTasks(); // refresh task list
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

  const handleUpload = async () => {
    if (!file && !videoUrl) return;

    try {
      setStatus({ progress: 0.1, desc: '初始化上传...', state: 'pending' });
      setResults(null);

      const options: UploadOptions = {
        videoUrl: videoUrl || undefined,
        asrEngine,
        extractClips,
        addOverlay,
        generateArticle,
        generateImages,
        generateHtml,
        customPrompt,
        llmApiKey: llmSettings.apiKey,
        llmBaseUrl: llmSettings.baseUrl,
        llmModel: llmSettings.model
      };

      const newTaskId = await uploadVideo(options, file);
      setTaskId(newTaskId);
      loadTasks();
    } catch (err) {
      console.error(err);
      setStatus({ progress: 0, desc: '上传失败', state: 'error' });
    }
  };

  const handleTTSGenerate = async (options: TTSOptions) => {
    try {
      setStatus({ progress: 0.1, desc: '初始化任务...', state: 'pending' });
      setResults(null);
      const newTaskId = await generateTTSVideo(options);
      setTaskId(newTaskId);
      setReGenerateOptions(null); // Clear after start
      loadTasks();
    } catch (err) {
      console.error(err);
      setStatus({ progress: 0, desc: '生成失败', state: 'error' });
    }
  };

  const handleReGenerate = (options: TTSOptions) => {
    setWorkflowMode('text-to-video');
    setReGenerateOptions(options);
    setTaskId(null);
    setResults(null);
    setStatus(null);
  };

  const resetToUpload = () => {
    setFile(null);
    setVideoUrl('');
    setTaskId(null);
    setResults(null);
    setStatus(null);
    setReGenerateOptions(null);
  };

  return (
    <div className="layout-container">
      <Sidebar
        tasks={tasks}
        taskId={taskId}
        onSelectTask={selectTask}
        onNewVideo={resetToUpload}
      />

      <div className="main-content">
        <div className="app-container">
          <header className="header">
            <h1>Clip2Post</h1>
            <p>AI Video Configuration & Processing</p>
          </header>

          <div className="workflow-switcher" style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', justifyContent: 'center' }}>
            <button
              className={workflowMode === 'video-to-post' ? 'btn-toggle active' : 'btn-toggle'}
              onClick={() => { setWorkflowMode('video-to-post'); resetToUpload(); }}
              style={{ padding: '0.6rem 1.2rem', borderRadius: '20px', border: '1px solid var(--border-color)', background: workflowMode === 'video-to-post' ? 'var(--accent-primary)' : 'rgba(255,255,255,0.05)', cursor: 'pointer', transition: 'all 0.3s' }}
            >
              📹 Video-to-Post
            </button>
            <button
              className={workflowMode === 'text-to-video' ? 'btn-toggle active' : 'btn-toggle'}
              onClick={() => { setWorkflowMode('text-to-video'); resetToUpload(); }}
              style={{ padding: '0.6rem 1.2rem', borderRadius: '20px', border: '1px solid var(--border-color)', background: workflowMode === 'text-to-video' ? 'var(--accent-primary)' : 'rgba(255,255,255,0.05)', cursor: 'pointer', transition: 'all 0.3s' }}
            >
              文字转视频 (Text-to-Video)
            </button>
          </div>

          <div className="glass-panel">
            {!taskId || status?.state === 'error' ? (
              workflowMode === 'video-to-post' ? (
                <UploadForm
                  file={file}
                  videoUrl={videoUrl}
                  onVideoUrlChange={setVideoUrl}
                  isDragging={isDragging}
                  onFileSelect={(file) => {
                    setFile(file);
                    if (file) setVideoUrl(''); // clear URL if file is selected
                    setTaskId(null);
                    setResults(null);
                    setStatus(null);
                  }}
                  onDragStateChange={setIsDragging}
                  asrEngine={asrEngine}
                  onAsrChange={setAsrEngine}
                  options={{
                    extractClips,
                    addOverlay,
                    generateArticle,
                    generateImages,
                    generateHtml,
                    customPrompt
                  }}
                  onOptionsChange={(opts) => {
                    setExtractClips(opts.extractClips);
                    setAddOverlay(opts.addOverlay);
                    setGenerateArticle(opts.generateArticle);
                    setGenerateImages(opts.generateImages);
                    setGenerateHtml(opts.generateHtml);
                    setCustomPrompt(opts.customPrompt);
                  }}
                  onLlmSettingsChange={setLlmSettings}
                  onUpload={handleUpload}
                  disableUpload={!file && !videoUrl}
                  isErrorState={status?.state === 'error'}
                />
              ) : (
                <TTSVideoForm
                  onGenerate={handleTTSGenerate}
                  initialOptions={reGenerateOptions || undefined}
                  disabled={status?.state === 'pending' || status?.state === 'processing'}
                />
              )
            ) : (
              <div className="progress-container">
                <div className="progress-header">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {status?.state === 'processing' && <Loader2 className="spinner" size={18} />}
                    {status?.state === 'completed' && <CheckCircle2 size={18} color="var(--success-color)" />}
                    {status?.state === 'error' && <AlertCircle size={18} color="#ef4444" />}
                    <span style={{ color: status?.state === 'error' ? '#ef4444' : (status?.state === 'completed' ? 'var(--success-color)' : 'inherit') }}>
                      {status?.desc || 'Processing...'}
                    </span>
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
        </div>

        {results && (
          <ResultsDisplay
            results={results}
            taskId={taskId!}
            llmSettings={llmSettings}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onTaskCreated={selectTask}
            onReGenerate={handleReGenerate}
          />
        )}
      </div>
    </div>
  );
}

export default App;
