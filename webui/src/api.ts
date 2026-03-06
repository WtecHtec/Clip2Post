const API_BASE_URL = 'http://localhost:8000/api';

export interface TaskStatus {
  progress: number;
  desc: string;
  state: 'pending' | 'processing' | 'completed' | 'error';
}

export interface TaskResults {
  subtitles: string;
  markdown: string;
  images: string[];
  html_url: string;
}

export const uploadVideo = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append('file', file);

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

export const getAssetUrl = (path: string): string => {
  if (path.startsWith('http')) return path;
  return `http://localhost:8000${path}`;
};
