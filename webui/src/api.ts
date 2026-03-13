import type { LLMSettings } from './components/SettingsPanel';
export type { LLMSettings };

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
  tts_config?: TTSOptions;
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

export interface TTSOptions {
  text: string;
  ttsEngine: string;
  voice: string;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  speed?: number;
  refine_text?: boolean;
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

export const generateTTSVideo = async (options: TTSOptions): Promise<string> => {
  const formData = new FormData();
  formData.append('text', options.text);
  formData.append('tts_engine', options.ttsEngine);
  formData.append('voice', options.voice);

  if (options.temperature !== undefined) formData.append('temperature', String(options.temperature));
  if (options.top_p !== undefined) formData.append('top_p', String(options.top_p));
  if (options.top_k !== undefined) formData.append('top_k', String(options.top_k));
  if (options.speed !== undefined) formData.append('speed', String(options.speed));
  if (options.refine_text !== undefined) formData.append('refine_text', String(options.refine_text));

  const response = await fetch(`${API_BASE_URL}/tts_render`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`TTS Render failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.task_id;
};

export const generateAgentVideo = async (
  options: TTSOptions,
  images: File[],
  imageDescriptions: { id: string, desc: string }[],
  prompt: string,
  llmSettings: LLMSettings
): Promise<{ taskId: string, generatedText: string }> => {
  const formData = new FormData();
  formData.append('prompt', prompt);
  formData.append('text', options.text);
  formData.append('tts_engine', options.ttsEngine);
  formData.append('voice', options.voice);
  if (options.temperature !== undefined) formData.append('temperature', String(options.temperature));
  if (options.top_p !== undefined) formData.append('top_p', String(options.top_p));
  if (options.top_k !== undefined) formData.append('top_k', String(options.top_k));
  if (options.speed !== undefined) formData.append('speed', String(options.speed));
  if (options.refine_text !== undefined) formData.append('refine_text', String(options.refine_text));

  formData.append('image_descriptions', JSON.stringify(imageDescriptions));
  images.forEach(file => {
    formData.append('images', file);
  });

  formData.append('llm_api_key', llmSettings.apiKey);
  formData.append('llm_base_url', llmSettings.baseUrl);
  formData.append('llm_model', llmSettings.model);

  const response = await fetch(`${API_BASE_URL}/agent_video`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || `Agent Video generation failed: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    taskId: data.task_id,
    generatedText: data.generated_text
  };
};

export const generateAIScript = async (taskId: string, prompt: string, llmSettings: LLMSettings): Promise<string> => {
  const formData = new FormData();
  formData.append('task_id', taskId);
  formData.append('prompt', prompt);
  formData.append('llm_api_key', llmSettings.apiKey);
  formData.append('llm_base_url', llmSettings.baseUrl);
  formData.append('llm_model', llmSettings.model);

  const response = await fetch(`${API_BASE_URL}/ai_script`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || `AI Script generation failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.script;
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
