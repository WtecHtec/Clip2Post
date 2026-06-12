import type { LLMSettings } from './components/SettingsPanel';
export type { LLMSettings };

const API_BASE_URL = 'http://localhost:8000/api';

export interface TaskStatus {
  progress: number;
  desc: string;
  state: 'pending' | 'processing' | 'completed' | 'error';
  task_type?: 'standard' | 'agent';
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
  task_type?: 'standard' | 'agent';
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
  coverTitle?: string;
  coverImage?: File;
  bgm?: string;
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
  if (options.coverTitle) formData.append('cover_title', options.coverTitle);
  if (options.coverImage) formData.append('cover_image', options.coverImage);
  if (options.bgm) formData.append('bgm', options.bgm);

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
  if (options.bgm) formData.append('bgm', options.bgm);

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

export const transcribeAudio = async (file: File, asrEngine: string): Promise<{ task_id: string, shuo_props: any }> => {
  const formData = new FormData();
  formData.append('audio', file);
  formData.append('asr_engine', asrEngine);

  const response = await fetch(`${API_BASE_URL}/audio_transcribe`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Transcription failed: ${response.statusText}`);
  }

  return await response.json();
};

export const renderAudioVideo = async (taskId: string, shuoProps: any): Promise<void> => {
  const formData = new FormData();
  formData.append('task_id', taskId);
  formData.append('shuo_props', JSON.stringify(shuoProps));

  const response = await fetch(`${API_BASE_URL}/audio_render`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Render failed: ${response.statusText}`);
  }
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

export const generateImageVideo = async (options: TTSOptions, image: File): Promise<string> => {
  const formData = new FormData();
  formData.append('text', options.text);
  formData.append('tts_engine', options.ttsEngine);
  formData.append('voice', options.voice);
  if (options.temperature !== undefined) formData.append('temperature', String(options.temperature));
  if (options.top_p !== undefined) formData.append('top_p', String(options.top_p));
  if (options.top_k !== undefined) formData.append('top_k', String(options.top_k));
  if (options.speed !== undefined) formData.append('speed', String(options.speed));
  if (options.refine_text !== undefined) formData.append('refine_text', String(options.refine_text));
  if (options.coverTitle) formData.append('cover_title', options.coverTitle);
  if (options.bgm) formData.append('bgm', options.bgm);

  formData.append('image', image);

  const response = await fetch(`${API_BASE_URL}/image_video`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    let errorMessage = response.statusText;
    try {
      const errorData = await response.json();
      if (errorData.error) errorMessage = errorData.error;
    } catch (e) { }
    throw new Error(`Image Video generation failed: ${errorMessage}`);
  }

  const data = await response.json();
  return data.task_id;
};

export const getBgms = async (): Promise<string[]> => {
  try {
    const res = await fetch(`${API_BASE_URL}/bgms`);
    if (!res.ok) throw new Error('Network error');
    const data = await res.json();
    return data.bgms || [];
  } catch (error) {
    console.error('Error fetching BGMs:', error);
    return [];
  }
};

export const getBgImages = async (): Promise<string[]> => {
  try {
    const res = await fetch(`${API_BASE_URL}/bg_images`);
    if (!res.ok) throw new Error('Network error');
    const data = await res.json();
    return data.bg_images || [];
  } catch (error) {
    console.error('Error fetching background images:', error);
    return [];
  }
};

export interface NewsVideoOptions {
  openingHook?: string;
  mainText: string;
  endingHook?: string;
  ttsEngine: string;
  voice: string;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  speed?: number;
  refine_text?: boolean;
  coverTitle?: string;
  endingTitle?: string;
  bgm?: string;
}

export const generateNewsVideo = async (options: NewsVideoOptions, image: File): Promise<string> => {
  const formData = new FormData();
  if (options.openingHook) formData.append('opening_hook', options.openingHook);
  formData.append('main_text', options.mainText);
  if (options.endingHook) formData.append('ending_hook', options.endingHook);
  
  formData.append('tts_engine', options.ttsEngine);
  formData.append('voice', options.voice);
  if (options.temperature !== undefined) formData.append('temperature', String(options.temperature));
  if (options.top_p !== undefined) formData.append('top_p', String(options.top_p));
  if (options.top_k !== undefined) formData.append('top_k', String(options.top_k));
  if (options.speed !== undefined) formData.append('speed', String(options.speed));
  if (options.refine_text !== undefined) formData.append('refine_text', String(options.refine_text));
  
  if (options.coverTitle) formData.append('cover_title', options.coverTitle);
  if (options.endingTitle) formData.append('ending_title', options.endingTitle);
  if (options.bgm) formData.append('bgm', options.bgm);

  formData.append('image', image);

  const response = await fetch(`${API_BASE_URL}/news_video`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    let errorMessage = response.statusText;
    try {
      const errorData = await response.json();
      if (errorData.error) errorMessage = errorData.error;
    } catch (e) { }
    throw new Error(`News Video generation failed: ${errorMessage}`);
  }

  const data = await response.json();
  return data.task_id;
};

export interface DynamicVideoOptions {
  prompt: string;
  ttsEngine: string;
  voice: string;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  speed?: number;
  refine_text?: boolean;
  bgm?: string;
  aspectRatio?: '9:16' | '16:9';
  files?: File[];
  imageDescriptions?: string;
  maxRetries?: number;
  mode?: 'prompt' | 'json' | 'voiceover';
  alsoGenerateLandscape?: boolean;
}

export const generateDynamicVideo = async (options: DynamicVideoOptions): Promise<string> => {
  const formData = new FormData();
  formData.append('prompt', options.prompt);
  formData.append('tts_engine', options.ttsEngine);
  formData.append('voice', options.voice);
  if (options.mode) formData.append('mode', options.mode);
  if (options.temperature !== undefined) formData.append('temperature', String(options.temperature));
  if (options.top_p !== undefined) formData.append('top_p', String(options.top_p));
  if (options.top_k !== undefined) formData.append('top_k', String(options.top_k));
  if (options.speed !== undefined) formData.append('speed', String(options.speed));
  if (options.refine_text !== undefined) formData.append('refine_text', String(options.refine_text));
  if (options.bgm) formData.append('bgm', options.bgm);
  if (options.aspectRatio) formData.append('aspect_ratio', options.aspectRatio);

  if (options.files) {
    options.files.forEach((file) => {
      formData.append('files', file);
    });
  }
  if (options.imageDescriptions) {
    formData.append('image_descriptions', options.imageDescriptions);
  }
  if (options.maxRetries !== undefined) {
    formData.append('max_retries', String(options.maxRetries));
  }
  if (options.alsoGenerateLandscape !== undefined) {
    formData.append('also_generate_landscape', String(options.alsoGenerateLandscape));
  }

  const response = await fetch(`${API_BASE_URL}/dynamic_video`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    let errorMessage = response.statusText;
    try {
      const errorData = await response.json();
      if (errorData.error) errorMessage = errorData.error;
    } catch (e) { }
    throw new Error(`Dynamic Video generation failed: ${errorMessage}`);
  }

  const data = await response.json();
  return data.task_id;
};
export const regenerateDynamicVideo = async (taskId: string): Promise<string> => {
  const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/regenerate_dynamic`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`Regeneration failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.task_id;
};
