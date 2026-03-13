import React, { useState } from 'react';
import { Music, FileJson, Play, RefreshCw, Upload, AlertCircle } from 'lucide-react';
import { transcribeAudio, renderAudioVideo } from '../api';

interface AudioVideoFormProps {
    onTaskStarted: (taskId: string) => void;
    disabled?: boolean;
}

export const AudioVideoForm: React.FC<AudioVideoFormProps> = ({ onTaskStarted, disabled }) => {
    const [file, setFile] = useState<File | null>(null);
    const [asrEngine, setAsrEngine] = useState('funasr');
    const [step, setStep] = useState<'upload' | 'edit'>('upload');
    const [taskId, setTaskId] = useState<string | null>(null);
    const [jsonText, setJsonText] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleTranscribe = async () => {
        if (!file) return;
        setIsProcessing(true);
        setError(null);
        try {
            const result = await transcribeAudio(file, asrEngine);
            setTaskId(result.task_id);
            setJsonText(JSON.stringify(result.shuo_props, null, 2));
            setStep('edit');
        } catch (err: any) {
            setError(err.message || '识别失败');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRender = async () => {
        if (!taskId) return;
        setIsProcessing(true);
        setError(null);
        try {
            let parsedProps;
            try {
                parsedProps = JSON.parse(jsonText);
            } catch (e) {
                throw new Error('JSON 格式错误，请检查内容');
            }
            await renderAudioVideo(taskId, parsedProps);
            onTaskStarted(taskId);
        } catch (err: any) {
            setError(err.message || '提交渲染失败');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReset = () => {
        setStep('upload');
        setTaskId(null);
        setJsonText('');
        setFile(null);
        setError(null);
    };

    if (step === 'upload') {
        return (
            <div className="audio-video-form">
                <div style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <Music size={24} color="var(--accent-primary)" /> 上传原声配音
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                        上传您的音频文件（.mp3, .wav），我们将自动提取字幕并生成视频排版配置。
                    </p>

                    <div
                        className="upload-dropzone"
                        style={{
                            border: '2px dashed var(--border-color)',
                            borderRadius: '16px',
                            padding: '3rem 2rem',
                            textAlign: 'center',
                            cursor: 'pointer',
                            backgroundColor: 'rgba(255,255,255,0.02)',
                            transition: 'all 0.3s ease'
                        }}
                        onClick={() => document.getElementById('audio-upload')?.click()}
                    >
                        <input
                            id="audio-upload"
                            type="file"
                            accept="audio/*"
                            style={{ display: 'none' }}
                            onChange={(e) => setFile(e.target.files?.[0] || null)}
                        />
                        {file ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                                <CheckCircle2 size={48} color="#10b981" />
                                <span style={{ fontSize: '1rem', fontWeight: 500 }}>{file.name}</span>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>已准备好识别</span>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                                <Upload size={48} color="var(--text-muted)" />
                                <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>点击或拖拽音频文件到此处</span>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>支持 MP3, WAV, M4A</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="option-section">
                    <h4 className="section-title">识别引擎</h4>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                        {['funasr', 'faster-whisper', 'whisperx'].map(engine => (
                            <label key={engine} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                <input
                                    type="radio"
                                    name="asrEngine"
                                    value={engine}
                                    checked={asrEngine === engine}
                                    onChange={() => setAsrEngine(engine)}
                                    style={{ accentColor: 'var(--accent-primary)' }}
                                />
                                <span style={{ textTransform: 'capitalize' }}>{engine}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {error && (
                    <div style={{ color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '0.8rem', borderRadius: '8px', marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                        <AlertCircle size={18} /> {error}
                    </div>
                )}

                <button
                    className="btn-primary"
                    onClick={handleTranscribe}
                    disabled={disabled || !file || isProcessing}
                    style={{ width: '100%', marginTop: '2rem' }}
                >
                    {isProcessing ? '正在提取字幕...' : '下一步：提取字幕'}
                    {isProcessing ? <RefreshCw className="animate-spin" size={18} /> : <FileJson size={18} />}
                </button>
            </div>
        );
    }

    return (
        <div className="audio-video-form">
            <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.2rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <FileJson size={24} color="var(--accent-primary)" /> 编辑视频配置 (shuo.json)
                </h3>
                <button
                    onClick={handleReset}
                    style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '0.9rem', textDecoration: 'underline' }}
                >
                    重新上传
                </button>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                您可以手动调整时间轴、文字内容，或修改排版参数（如 fontSize）。
            </p>

            <textarea
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                spellCheck={false}
                style={{
                    width: '100%',
                    minHeight: '400px',
                    padding: '1rem',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: '#1e1e1e',
                    color: '#d4d4d4',
                    fontFamily: 'monospace',
                    fontSize: '0.9rem',
                    lineHeight: '1.5',
                    outline: 'none',
                    resize: 'vertical'
                }}
            />

            {error && (
                <div style={{ color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '0.8rem', borderRadius: '8px', marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                    <AlertCircle size={18} /> {error}
                </div>
            )}

            <button
                className="btn-primary"
                onClick={handleRender}
                disabled={disabled || isProcessing}
                style={{ width: '100%', marginTop: '1.5rem', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
            >
                {isProcessing ? '正在准备渲染...' : '提交：生成视频'}
                <Play size={18} fill="currentColor" />
            </button>
        </div>
    );
};

// Helper for icon
const CheckCircle2 = ({ size, color }: { size: number, color: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
);
