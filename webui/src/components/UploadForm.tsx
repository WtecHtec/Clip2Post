import React, { useRef } from 'react';
import { Upload } from 'lucide-react';
import classNames from 'classnames';
import { SettingsPanel } from './SettingsPanel';
import type { LLMSettings } from './SettingsPanel';

interface UploadFormProps {
    file: File | null;
    videoUrl: string;
    onVideoUrlChange: (url: string) => void;
    isDragging: boolean;
    onFileSelect: (file: File | null) => void;
    onDragStateChange: (state: boolean) => void;

    // ASR Configuration
    asrEngine: string;
    onAsrChange: (engine: string) => void;

    // Checkbox Configurations
    options: {
        extractClips: boolean;
        addOverlay: boolean;
        generateArticle: boolean;
        generateImages: boolean;
        generateHtml: boolean;
        customPrompt: string;
    };
    onOptionsChange: (options: any) => void;

    // LLM Configurations
    onLlmSettingsChange: (settings: LLMSettings) => void;

    // Actions
    onUpload: () => void;
    disableUpload: boolean;
    isErrorState: boolean;
}

export const UploadForm: React.FC<UploadFormProps> = ({
    file,
    videoUrl,
    onVideoUrlChange,
    isDragging,
    onFileSelect,
    onDragStateChange,
    asrEngine,
    onAsrChange,
    options,
    onOptionsChange,
    onLlmSettingsChange,
    onUpload,
    disableUpload,
    isErrorState
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            onFileSelect(e.target.files[0]);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        onDragStateChange(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const droppedFile = e.dataTransfer.files[0];
            if (droppedFile.type.startsWith('video/')) {
                onFileSelect(droppedFile);
            } else {
                alert("Please upload a video file.");
            }
        }
    };

    const updateOption = (key: string, value: any) => {
        onOptionsChange({ ...options, [key]: value });
    };

    return (
        <>
            <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Video Source</h3>

                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                    <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                            Option A: Enter Video URL
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. https://www.youtube.com/watch?v=..."
                            value={videoUrl}
                            onChange={(e) => onVideoUrlChange(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                borderRadius: '8px',
                                border: '1px solid var(--border-color)',
                                backgroundColor: 'rgba(0,0,0,0.3)',
                                color: 'var(--text-primary)',
                                outline: 'none'
                            }}
                            disabled={file !== null}
                        />
                    </div>
                </div>

                <div
                    style={{ position: 'relative' }}
                    className={classNames('upload-zone', {
                        'border-accent-primary transform -translate-y-1': isDragging,
                        'opacity-50 pointer-events-none': videoUrl.length > 0
                    })}
                    onDragOver={(e) => { e.preventDefault(); if (!videoUrl) onDragStateChange(true); }}
                    onDragLeave={() => onDragStateChange(false)}
                    onDrop={handleDrop}
                    onClick={() => { if (!videoUrl) fileInputRef.current?.click(); }}
                >
                    <Upload className="upload-icon mx-auto" />
                    <div className="upload-text">
                        {file ? file.name : (videoUrl ? 'URL provided (clear to upload file)' : 'Option B: Click or drag local video here')}
                    </div>
                    <div className="upload-hint">MP4, MOV, MKV up to 500MB</div>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="video/*"
                        className="hidden"
                        style={{ display: 'none' }}
                        disabled={videoUrl.length > 0}
                    />

                    {file && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onFileSelect(null); }}
                            style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        >
                            Remove File
                        </button>
                    )}
                </div>
            </div>

            <div className="upload-options">
                <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Processing Options</h3>

                <SettingsPanel onSettingsChange={onLlmSettingsChange} />

                <div className="form-group" style={{ marginBottom: '1.5rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <label style={{ display: 'block', marginBottom: '0.8rem', color: 'var(--text-secondary)' }}>
                        0. 语音识别引擎 (ASR Engine)
                    </label>
                    <div className="radio-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                        <label className="radio-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                            <input
                                type="radio"
                                name="asrEngine"
                                value="funasr"
                                checked={asrEngine === "funasr"}
                                onChange={() => onAsrChange("funasr")}
                                style={{ accentColor: 'var(--accent-primary)', width: '16px', height: '16px' }}
                            />
                            <span>FunASR (阿里开源, 快且准)</span>
                        </label>
                        <label className="radio-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                            <input
                                type="radio"
                                name="asrEngine"
                                value="faster-whisper"
                                checked={asrEngine === "faster-whisper"}
                                onChange={() => onAsrChange("faster-whisper")}
                                style={{ accentColor: 'var(--accent-primary)', width: '16px', height: '16px' }}
                            />
                            <span>Faster-Whisper (英文支持较好)</span>
                        </label>
                        <label className="radio-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                            <input
                                type="radio"
                                name="asrEngine"
                                value="whisperx"
                                checked={asrEngine === "whisperx"}
                                onChange={() => onAsrChange("whisperx")}
                                style={{ accentColor: 'var(--accent-primary)', width: '16px', height: '16px' }}
                            />
                            <span>WhisperX (精确词级对齐时间戳)</span>
                        </label>
                    </div>
                </div>

                <label className="checkbox-group">
                    <input
                        type="checkbox"
                        checked={options.extractClips}
                        onChange={e => updateOption('extractClips', e.target.checked)}
                    />
                    <span>1. 是否切割视频片段 (Extract Highlight Video Clips)</span>
                </label>

                {options.extractClips && (
                    <label className="checkbox-group" style={{ marginLeft: '2rem' }}>
                        <input
                            type="checkbox"
                            checked={options.addOverlay}
                            onChange={e => updateOption('addOverlay', e.target.checked)}
                        />
                        <span>2. 是否添加总结文案字幕 (Add Summary Overlay to Clips)</span>
                    </label>
                )}

                <label className="checkbox-group">
                    <input
                        type="checkbox"
                        checked={options.generateArticle}
                        onChange={e => updateOption('generateArticle', e.target.checked)}
                    />
                    <span>3. 是否生成文章 (Generate AI Article)</span>
                </label>

                {options.generateArticle && (
                    <div className="prompt-group" style={{ marginLeft: '2rem', marginBottom: '1rem', marginTop: 0 }}>
                        <label>可选：文章生成提示词 (Custom LLM Prompt)</label>
                        <textarea
                            className="prompt-textarea"
                            placeholder="e.g. Write the article in a comedic tone, focus on the tutorial aspects..."
                            value={options.customPrompt}
                            onChange={e => updateOption('customPrompt', e.target.value)}
                        />
                    </div>
                )}

                <label className="checkbox-group">
                    <input
                        type="checkbox"
                        checked={options.generateImages}
                        onChange={e => updateOption('generateImages', e.target.checked)}
                    />
                    <span>4. 是否生成视频图片 (Generate Screenshots)</span>
                </label>

                <label className="checkbox-group">
                    <input
                        type="checkbox"
                        checked={options.generateHtml}
                        onChange={e => updateOption('generateHtml', e.target.checked)}
                    />
                    <span>5. 是否转换html (Generate HTML Layout)</span>
                </label>
            </div>

            <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                <button
                    className="btn-primary"
                    onClick={onUpload}
                    disabled={disableUpload}
                >
                    {isErrorState ? 'Retry Upload' : 'Start Processing'}
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                </button>
            </div>
        </>
    );
};
