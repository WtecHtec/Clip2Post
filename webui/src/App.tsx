import { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { uploadVideo, pollStatus, fetchResults, fetchTasks } from './api';
import type { TaskStatus, TaskResults, UploadOptions, TaskOverview } from './api';

import { Sidebar } from './components/Sidebar';
import { UploadForm } from './components/UploadForm';
import { ResultsDisplay } from './components/ResultsDisplay';
import type { LLMSettings } from './components/SettingsPanel';

function App() {
  const [tasks, setTasks] = useState<TaskOverview[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [status, setStatus] = useState<TaskStatus | any>(null);
  const [results, setResults] = useState<TaskResults | null>(null);
  const [activeTab, setActiveTab] = useState<'subtitles' | 'markdown' | 'images' | 'html' | 'videos' | 'audio' | 'source'>('subtitles');
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

  const resetToUpload = () => {
    setFile(null);
    setVideoUrl('');
    setTaskId(null);
    setResults(null);
    setStatus(null);
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

          <div className="glass-panel">
            {!taskId || status?.state === 'error' ? (
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
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        )}
      </div>
    </div>
  );
}

export default App;
