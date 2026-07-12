import React, { useState, useEffect } from 'react';
import { Video, Play, RefreshCw, Upload, AlertCircle, Search, Music, Volume2 } from 'lucide-react';
import { generatePexelsVideo, getAssetUrl } from '../api';

interface PexelsVideoFormProps {
    onTaskStarted: (taskId: string) => void;
    disabled?: boolean;
}

export const PexelsVideoForm: React.FC<PexelsVideoFormProps> = ({ onTaskStarted, disabled }) => {
    const [file, setFile] = useState<File | null>(null);
    const [title, setTitle] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [subtitleLayout, setSubtitleLayout] = useState('scroll');
    const [asrEngine, setAsrEngine] = useState('funasr');
    
    // BGM state
    const [bgm, setBgm] = useState('');
    const [bgmList, setBgmList] = useState<string[]>([]);
    
    // Volume state
    const [mediaVolume, setMediaVolume] = useState(1.0);
    const [bgmVolume, setBgmVolume] = useState(0.15);
    
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch BGM list on mount
    useEffect(() => {
        import('../api').then(mod => {
            mod.getBgms().then(setBgmList).catch(err => {
                console.error("Failed to load BGMs:", err);
            });
        });
    }, []);

    // Paste file handler
    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            if (disabled || isProcessing) return;
            const files = e.clipboardData?.files;
            if (files && files.length > 0) {
                const videoFile = Array.from(files).find(f => f.type.startsWith('video/'));
                if (videoFile) {
                    setFile(videoFile);
                    e.preventDefault();
                }
            }
        };

        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [disabled, isProcessing]);

    const handleGenerate = async () => {
        if (!file) return;
        setIsProcessing(true);
        setError(null);
        try {
            const taskId = await generatePexelsVideo({
                videoFile: file,
                title: title.trim(),
                searchQuery: searchQuery.trim(),
                asrEngine,
                subtitleLayout,
                bgm,
                mediaVolume,
                bgmVolume
            });
            onTaskStarted(taskId);
        } catch (err: any) {
            setError(err.message || '启动生成任务失败');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="pexels-video-form">
            <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <Video size={24} color="var(--accent-primary)" /> 视频字幕与 Pexels 背景模式
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                    上传您的视频，系统将自动识别提取字幕为视频配音，并使用 Pexels 的视频库替换画面。
                </p>

                {/* Video Upload Dropzone */}
                <div
                    className="upload-dropzone"
                    style={{
                        border: '2px dashed var(--border-color)',
                        borderRadius: '16px',
                        padding: '3rem 2rem',
                        textAlign: 'center',
                        cursor: 'pointer',
                        backgroundColor: 'rgba(255,255,255,0.02)',
                        transition: 'all 0.3s ease',
                        marginBottom: '1.5rem'
                    }}
                    onClick={() => document.getElementById('pexels-video-direct-upload')?.click()}
                >
                    <input
                        id="pexels-video-direct-upload"
                        type="file"
                        accept="video/*"
                        style={{ display: 'none' }}
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                    />
                    {file ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                            <CheckCircle2 size={48} color="#10b981" />
                            <span style={{ fontSize: '1rem', fontWeight: 500 }}>{file.name}</span>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>点击或拖拽更换视频</span>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                            <Upload size={48} color="var(--text-muted)" />
                            <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>点击、拖拽或粘贴原视频文件到此处</span>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>支持 MP4, MOV, AVI 等常用视频格式</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Video Title */}
            <div className="option-section" style={{ marginBottom: '1.5rem' }}>
                <h4 className="section-title" style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Search size={18} color="var(--accent-primary)" /> 视频顶部标题 (可选)
                </h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.8rem' }}>
                    输入显示在视频顶部的标题文字。
                </p>
                <input
                    type="text"
                    placeholder="例如: 躺在床上仔细想想，我的心路历程..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    style={{
                        width: '100%',
                        padding: '0.8rem 1rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'rgba(255,255,255,0.03)',
                        color: 'var(--text-primary)',
                        fontSize: '0.95rem',
                        outline: 'none',
                        transition: 'border-color 0.2s'
                    }}
                />
            </div>

            {/* Pexels Search Query */}
            <div className="option-section" style={{ marginBottom: '1.5rem' }}>
                <h4 className="section-title" style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Search size={18} color="var(--accent-primary)" /> Pexels 背景搜索词 (可选)
                </h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.8rem' }}>
                    输入相关的英文或中文关键词来搜索背景视频。若留空，将直接使用默认暗色渐变背景。
                </p>
                <input
                    type="text"
                    placeholder="例如: sunset, coding。留空则使用默认渐变背景..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                        width: '100%',
                        padding: '0.8rem 1rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'rgba(255,255,255,0.03)',
                        color: 'var(--text-primary)',
                        fontSize: '0.95rem',
                        outline: 'none',
                        transition: 'border-color 0.2s'
                    }}
                />
            </div>

            {/* Subtitle Layout */}
            <div className="option-section" style={{ marginBottom: '1.5rem' }}>
                <h4 className="section-title" style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Video size={18} color="var(--accent-primary)" /> 字幕排版
                </h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.8rem' }}>
                    选择 Pexels 背景视频中的字幕展示样式。
                </p>
                <select
                    value={subtitleLayout}
                    onChange={(e) => setSubtitleLayout(e.target.value)}
                    style={{
                        width: '100%',
                        padding: '0.8rem 1rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: '#1b1b1b',
                        color: 'var(--text-primary)',
                        fontSize: '0.95rem',
                        outline: 'none'
                    }}
                >
                    <option value="scroll">居中滚动字幕</option>
                </select>
            </div>

            {/* BGM Config */}
            <div className="option-section" style={{ marginBottom: '1.5rem' }}>
                <h4 className="section-title" style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Music size={18} color="var(--accent-primary)" /> 背景音乐 (BGM) 选项
                </h4>
                <select
                    value={bgm}
                    onChange={(e) => setBgm(e.target.value)}
                    style={{
                        width: '100%',
                        padding: '0.8rem 1rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: '#1b1b1b',
                        color: 'var(--text-primary)',
                        fontSize: '0.95rem',
                        outline: 'none',
                        marginBottom: '0.8rem'
                    }}
                >
                    <option value="">无背景音乐 (No BGM)</option>
                    {bgmList.map(b => (
                        <option key={b} value={b}>{b}</option>
                    ))}
                </select>

                {bgm && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.5rem', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                            播放预览: {bgm}
                        </span>
                        <audio
                            key={bgm}
                            src={getAssetUrl(`/bgm/${bgm}`)}
                            controls
                            style={{ height: '30px', maxWidth: '180px' }}
                        />
                    </div>
                )}
            </div>

            {/* Volume Control Sliders */}
            <div className="option-section" style={{ marginBottom: '1.5rem' }}>
                <h4 className="section-title" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Volume2 size={18} color="var(--accent-primary)" /> 音量设置 (Volume Configuration)
                </h4>
                
                <div style={{ marginBottom: '1.2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                        <span>原声视频配音音量 (Voice Track Volume)</span>
                        <span style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>{Math.round(mediaVolume * 100)}%</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={mediaVolume}
                        onChange={(e) => setMediaVolume(parseFloat(e.target.value))}
                        style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
                    />
                </div>

                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                        <span>背景音乐音量 (BGM Volume)</span>
                        <span style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>{Math.round(bgmVolume * 100)}%</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="0.5"
                        step="0.01"
                        value={bgmVolume}
                        onChange={(e) => setBgmVolume(parseFloat(e.target.value))}
                        style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
                    />
                </div>
            </div>

            {/* ASR Engine Choice */}
            <div className="option-section" style={{ marginBottom: '2rem' }}>
                <h4 className="section-title">ASR 语音识别引擎</h4>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.8rem' }}>
                    {['funasr', 'faster-whisper', 'whisperx', 'qwen3-asr'].map(engine => (
                        <label key={engine} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                            <input
                                type="radio"
                                name="pexelsAsrEngine"
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
                onClick={handleGenerate}
                disabled={disabled || !file || isProcessing}
                style={{ width: '100%', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
            >
                {isProcessing ? '正在处理并合成视频...' : '生成视频 (Generate Video)'}
                {isProcessing ? <RefreshCw className="animate-spin" size={18} /> : <Play size={18} fill="currentColor" />}
            </button>
        </div>
    );
};

// Helper for check icon
const CheckCircle2 = ({ size, color }: { size: number, color: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
);
