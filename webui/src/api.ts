const API_BASE_URL = 'http://localhost:8000/api';

export interface TaskStatus {
  progress: number;
  desc: string;
  state: 'pending' | 'processing' | 'completed' | 'error';
}

export interface ClipMetadata {
  url: string;
  title: string;
  summary: string;
  content: string;
}

export interface TaskResults {
  subtitles: string;
  markdown: string;
  images: string[];
  html_url: string;
  video_clips?: ClipMetadata[];
  audio_url?: string;
  source_video?: string;
}

export interface TaskOverview extends TaskStatus {
  task_id: string;
  created_at?: number;
}

export interface UploadOptions {
  videoUrl?: string;
  asrEngine: string;
  extractClips: boolean;
  addOverlay: boolean;
  generateArticle: boolean;
  generateImages: boolean;
  generateHtml: boolean;
  customPrompt: string;
  llmApiKey: string;
  llmBaseUrl: string;
  llmModel: string;
}

export const uploadVideo = async (options: UploadOptions, file?: File | null): Promise<string> => {
  const formData = new FormData();
  if (file) {
    formData.append('file', file);
  }
  if (options) {
    if (options.videoUrl) {
      formData.append('video_url', options.videoUrl);
    }
    formData.append('asr_engine', options.asrEngine);
    formData.append('extract_clips', String(options.extractClips));
    formData.append('add_overlay', String(options.addOverlay));
    formData.append('generate_article', String(options.generateArticle));
    formData.append('generate_images', String(options.generateImages));
    formData.append('generate_html', String(options.generateHtml));
    formData.append('custom_prompt', options.customPrompt);
    formData.append('llm_api_key', options.llmApiKey);
    formData.append('llm_base_url', options.llmBaseUrl);
    formData.append('llm_model', options.llmModel);
  }

  const response = await fetch(`${API_BASE_URL}/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.task_id;
};

export const pollStatus = async (taskId: string): Promise<TaskStatus> => {
  const response = await fetch(`${API_BASE_URL}/status/${taskId}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch status`);
  }

  return await response.json();
};

export const fetchResults = async (taskId: string): Promise<TaskResults> => {
  const response = await fetch(`${API_BASE_URL}/results/${taskId}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch results`);
  }

  return await response.json();
};

export const fetchTasks = async (): Promise<TaskOverview[]> => {
  const response = await fetch(`${API_BASE_URL}/tasks`);

  if (!response.ok) {
    throw new Error(`Failed to fetch tasks`);
  }

  const data = await response.json();
  return data.tasks || [];
};

export const getAssetUrl = (path: string): string => {
  if (path.startsWith('http')) return path;
  return `http://localhost:8000${path}`;
};
