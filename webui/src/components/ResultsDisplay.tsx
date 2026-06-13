import React from 'react';
import classNames from 'classnames';
import { FileText, Image as ImageIcon, Layout, Video, Mic, Film, Sparkles, Type, Share2, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { getAssetUrl, regenerateDynamicVideo, fetchDistributeConfig, publishToPlatforms, fetchDistributeStatus, fetchDistributeLog } from '../api';
import type { TaskResults, PlatformConfig, DistributeStatus } from '../api';
import { AIVideoCreator } from './AIVideoCreator';
import type { LLMSettings } from './SettingsPanel';

interface ResultsDisplayProps {
    results: TaskResults;
    taskId: string;
    llmSettings: LLMSettings;
    activeTab: 'subtitles' | 'cleantext' | 'markdown' | 'images' | 'html' | 'videos' | 'audio' | 'source' | 'recreate' | 'distribute';
    onTabChange: (tab: 'subtitles' | 'cleantext' | 'markdown' | 'images' | 'html' | 'videos' | 'audio' | 'source' | 'recreate' | 'distribute') => void;
    onTaskCreated: (id: string) => void;
    onReGenerate?: (options: any) => void;
}

export const ResultsDisplay: React.FC<ResultsDisplayProps> = ({
    results,
    taskId,
    llmSettings,
    activeTab,
    onTabChange,
    onTaskCreated,
    onReGenerate
}) => {
    const activeMediaRef = React.useRef<HTMLVideoElement | HTMLAudioElement | null>(null);

    // Distribution state
    const [platforms, setPlatforms] = React.useState<PlatformConfig[]>([]);
    const [selectedPlatforms, setSelectedPlatforms] = React.useState<string[]>([]);
    const [sharedText, setSharedText] = React.useState('');
    const [selectedVideo, setSelectedVideo] = React.useState<string>('');
    const [distributeStatus, setDistributeStatus] = React.useState<Record<string, DistributeStatus>>({});
    const [logs, setLogs] = React.useState<Record<string, string>>({});
    const [showLogPlatform, setShowLogPlatform] = React.useState<string | null>(null);
    const [loadingConfig, setLoadingConfig] = React.useState(false);
    const [publishing, setPublishing] = React.useState(false);

    // Load configuration and initial status
    React.useEffect(() => {
        const initDistribute = async () => {
            setLoadingConfig(true);
            try {
                const configData = await fetchDistributeConfig();
                setPlatforms(configData.platforms);
                
                // Auto select first platform
                if (configData.platforms.length > 0) {
                    setSelectedPlatforms([configData.platforms[0].platform]);
                }
                
                // Load existing status
                const statusData = await fetchDistributeStatus(taskId);
                setDistributeStatus(statusData.status);
            } catch (err) {
                console.error("Failed to load distribution info:", err);
            } finally {
                setLoadingConfig(false);
            }
        };
        initDistribute();
    }, [taskId]);

    // Sync default sharedText with markdown summary or subtitle or cover title if available
    React.useEffect(() => {
        if (results) {
            // Set default shared text from sns_title if present (e.g. JSON mode), otherwise fallback
            let defaultText = results.sns_title || '';
            
            // Try to load from browser localStorage cache as fallback
            if (!defaultText) {
                try {
                    const cachedPrompt = localStorage.getItem('dynamic-video-jsonPrompt');
                    if (cachedPrompt) {
                        const parsed = JSON.parse(cachedPrompt);
                        defaultText = parsed.snsTitle || parsed.sns_title || '';
                    }
                } catch (e) {
                    console.error("Failed to load snsTitle from localStorage cache:", e);
                }
            }
            
            // If still empty, use fallback summaries
            if (!defaultText) {
                defaultText = results.markdown 
                    ? results.markdown.split('\n').filter(line => line.trim() && !line.startsWith('#') && !line.startsWith('!')).slice(0, 3).join('\n').replace(/[#*`]/g, '').trim()
                    : (results.subtitles ? results.subtitles.replace(/\[\d{2}:\d{2}:\d{2}\]\s*/g, '').slice(0, 150).trim() : '');
            }
            
            setSharedText(defaultText);
            
            // Select default video
            if (results.video_clips && results.video_clips.length > 0) {
                const parts = results.video_clips[0].url.split('/');
                const filename = parts[parts.length - 1];
                setSelectedVideo(filename);
            }
        }
    }, [results]);

    // Polling distribution status
    React.useEffect(() => {
        let intervalId: any = null;
        const hasRunning = Object.values(distributeStatus).some(s => s.state === 'running');
        
        if (hasRunning) {
            intervalId = setInterval(async () => {
                try {
                    const statusData = await fetchDistributeStatus(taskId);
                    setDistributeStatus(statusData.status);
                } catch (err) {
                    console.error("Polling error:", err);
                }
            }, 2000);
        }
        
        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [distributeStatus, taskId]);

    const handlePublish = async (platformsToPublish: string[]) => {
        if (platformsToPublish.length === 0) {
            alert("请至少选择一个平台发布");
            return;
        }
        setPublishing(true);
        try {
            await publishToPlatforms({
                task_id: taskId,
                platforms: platformsToPublish,
                shared_text: sharedText,
                video_name: selectedVideo || undefined
            });
            
            // Update local status to running immediately
            const newStatus = { ...distributeStatus };
            platformsToPublish.forEach(p => {
                newStatus[p] = { state: 'running', updated_at: new Date().toISOString() };
            });
            setDistributeStatus(newStatus);
        } catch (err: any) {
            alert("发布任务启动失败: " + err.message);
        } finally {
            setPublishing(false);
        }
    };

    const handleToggleSelect = (platform: string) => {
        setSelectedPlatforms(prev => 
            prev.includes(platform) ? prev.filter(p => p !== platform) : [...prev, platform]
        );
    };

    const handleFetchLog = async (platform: string) => {
        if (showLogPlatform === platform) {
            setShowLogPlatform(null);
            return;
        }
        try {
            const logData = await fetchDistributeLog(taskId, platform);
            setLogs(prev => ({ ...prev, [platform]: logData.log }));
            setShowLogPlatform(platform);
        } catch (err: any) {
            alert("获取日志失败: " + err.message);
        }
    };

    const handlePlay = (e: React.SyntheticEvent<HTMLVideoElement | HTMLAudioElement>) => {
        const media = e.currentTarget;
        if (activeMediaRef.current && activeMediaRef.current !== media) {
            activeMediaRef.current.pause();
        }
        activeMediaRef.current = media;
    };

    // Empty State Helper Component
    const EmptyState = ({ message, Icon }: { message: string, Icon: React.ElementType }) => (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            minHeight: '200px',
            color: 'var(--text-secondary)',
            gap: '1rem',
            background: 'rgba(0,0,0,0.1)',
            borderRadius: '8px',
            border: '1px dashed rgba(255,255,255,0.1)'
        }}>
            <Icon size={48} opacity={0.3} />
            <p style={{ fontSize: '1.1rem', margin: 0 }}>{message}</p>
        </div>
    );

    const selectedClip = results.video_clips?.find(clip => clip.url.endsWith(selectedVideo));
    const currentLocalPath = selectedClip?.local_path || '';

    return (
        <div className="tabs-container">
            <div className="tabs-list">
                <button
                    className={classNames('tab-btn', { active: activeTab === 'source' })}
                    onClick={() => onTabChange('source')}
                >
                    <Film size={16} style={{ display: 'inline', marginRight: '6px' }} />
                    Original Video
                </button>
                <button
                    className={classNames('tab-btn', { active: activeTab === 'subtitles' })}
                    onClick={() => onTabChange('subtitles')}
                >
                    <FileText size={16} style={{ display: 'inline', marginRight: '6px' }} />
                    Subtitles
                </button>
                <button
                    className={classNames('tab-btn', { active: activeTab === 'cleantext' })}
                    onClick={() => onTabChange('cleantext')}
                >
                    <Type size={16} style={{ display: 'inline', marginRight: '6px' }} />
                    Raw Text
                </button>
                <button
                    className={classNames('tab-btn', { active: activeTab === 'markdown' })}
                    onClick={() => onTabChange('markdown')}
                >
                    <FileText size={16} style={{ display: 'inline', marginRight: '6px' }} />
                    AI Article
                </button>
                <button
                    className={classNames('tab-btn', { active: activeTab === 'images' })}
                    onClick={() => onTabChange('images')}
                >
                    <ImageIcon size={16} style={{ display: 'inline', marginRight: '6px' }} />
                    Screenshots
                </button>
                <button
                    className={classNames('tab-btn', { active: activeTab === 'html' })}
                    onClick={() => onTabChange('html')}
                >
                    <Layout size={16} style={{ display: 'inline', marginRight: '6px' }} />
                    Final Layout
                </button>
                <button
                    className={classNames('tab-btn', { active: activeTab === 'videos' })}
                    onClick={() => onTabChange('videos')}
                >
                    <Video size={16} style={{ display: 'inline', marginRight: '6px' }} />
                    Video Clips
                </button>
                <button
                    className={classNames('tab-btn', { active: activeTab === 'audio' })}
                    onClick={() => onTabChange('audio')}
                >
                    <Mic size={16} style={{ display: 'inline', marginRight: '6px' }} />
                    Audio
                </button>
                <button
                    className={classNames('tab-btn', { active: activeTab === 'distribute' })}
                    onClick={() => onTabChange('distribute')}
                    style={{ border: '1px dashed var(--accent-primary)', background: activeTab === 'distribute' ? 'rgba(59, 130, 246, 0.15)' : 'transparent', color: activeTab === 'distribute' ? 'var(--accent-primary)' : 'inherit' }}
                >
                    <Share2 size={16} style={{ display: 'inline', marginRight: '6px' }} />
                    Publish (发布分发)
                </button>
                {(results.task_type !== 'agent') && (
                    <button
                        className={classNames('tab-btn', { active: activeTab === 'recreate' })}
                        onClick={() => onTabChange('recreate')}
                        style={{ marginLeft: 'auto', border: '1px solid var(--accent-primary)', background: activeTab === 'recreate' ? 'var(--accent-primary)' : 'transparent' }}
                    >
                        <Sparkles size={16} style={{ display: 'inline', marginRight: '6px' }} />
                        AI Recreate
                    </button>
                )}
            </div>

            <div className="tab-content">
                {activeTab === 'source' && (
                    <div className="video-grid" style={{ gridTemplateColumns: '1fr' }}>
                        {results.source_video ? (
                            <div className="video-item">
                                <video
                                    src={getAssetUrl(results.source_video)}
                                    controls
                                    style={{ maxHeight: '600px', width: 'auto' }}
                                    onPlay={handlePlay}
                                />
                            </div>
                        ) : (
                            <EmptyState message="No original video file found." Icon={Film} />
                        )}
                    </div>
                )}

                {activeTab === 'subtitles' && (
                    results.subtitles ? (
                        <textarea
                            className="textarea-styled"
                            readOnly
                            value={results.subtitles}
                        />
                    ) : (
                        <EmptyState message="No subtitles extracted." Icon={FileText} />
                    )
                )}

                {activeTab === 'cleantext' && (
                    results.subtitles ? (
                        <textarea
                            className="textarea-styled"
                            readOnly
                            value={results.subtitles.replace(/\[\d{2}:\d{2}:\d{2}\]\s*/g, '').replace(/\n\s*\n/g, '\n').trim()}
                        />
                    ) : (
                        <EmptyState message="No subtitles to clean." Icon={Type} />
                    )
                )}

                {activeTab === 'markdown' && (
                    results.markdown ? (
                        <textarea
                            className="textarea-styled"
                            readOnly
                            value={results.markdown}
                        />
                    ) : (
                        <EmptyState message="No AI article generated." Icon={FileText} />
                    )
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
                            <div style={{ gridColumn: '1 / -1' }}>
                                <EmptyState message="No screenshots extracted." Icon={ImageIcon} />
                            </div>
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
                            <EmptyState message="HTML layout preview not available." Icon={Layout} />
                        )}
                    </div>
                )}

                {activeTab === 'videos' && (
                    <div className="video-list">
                        <div style={{
                            marginBottom: '1.5rem',
                            display: 'flex',
                            justifyContent: 'flex-end'
                        }}>
                            <button
                                className="btn-primary"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    padding: '0.6rem 1.2rem',
                                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
                                }}
                                onClick={async () => {
                                    try {
                                        const id = await regenerateDynamicVideo(taskId);
                                        onTaskCreated(id);
                                    } catch (err) {
                                        alert('Regeneration failed: ' + err);
                                    }
                                }}
                            >
                                <Sparkles size={16} />
                                再生成一个视频 (Regenerate Another)
                            </button>
                        </div>
                        {results.video_clips && results.video_clips.length > 0 ? (
                            results.video_clips.map((clip, i) => (
                                <div key={i} className="video-clip-item" style={{
                                    display: 'flex',
                                    gap: '2rem',
                                    padding: '1.5rem',
                                    background: 'rgba(255, 255, 255, 0.03)',
                                    borderRadius: '12px',
                                    marginBottom: '1.5rem',
                                    border: '1px solid rgba(255, 255, 255, 0.05)'
                                }}>
                                    <div className="video-clip-player" style={{ flex: '0 0 400px' }}>
                                        <video
                                            src={getAssetUrl(clip.url)}
                                            controls
                                            style={{ width: '100%', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}
                                            onPlay={handlePlay}
                                        />
                                    </div>
                                    <div className="video-clip-info" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                        <h3 style={{
                                            margin: 0,
                                            fontSize: '1.4rem',
                                            color: '#fff',
                                            borderLeft: '4px solid #3b82f6',
                                            paddingLeft: '12px'
                                        }}>
                                            {clip.title}
                                        </h3>
                                        <div style={{
                                            fontSize: '1rem',
                                            color: '#3b82f6',
                                            fontWeight: 500,
                                            background: 'rgba(59, 130, 246, 0.1)',
                                            padding: '4px 12px',
                                            borderRadius: '4px',
                                            alignSelf: 'start'
                                        }}>
                                            {clip.summary}
                                        </div>
                                        <div style={{
                                            fontSize: '0.95rem',
                                            color: 'rgba(255, 255, 255, 0.8)',
                                            lineHeight: 1.6,
                                            whiteSpace: 'pre-wrap',
                                            background: 'rgba(0, 0, 0, 0.2)',
                                            padding: '1rem',
                                            borderRadius: '8px'
                                        }}>
                                            {clip.content}
                                        </div>
                                        <button
                                            className="btn-secondary"
                                            style={{
                                                padding: '0.5rem 1rem',
                                                fontSize: '0.9rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.4rem',
                                                borderColor: 'var(--accent-primary)',
                                                color: 'var(--accent-primary)',
                                                marginTop: '0.5rem',
                                                alignSelf: 'start',
                                                cursor: 'pointer'
                                            }}
                                            onClick={() => {
                                                const parts = clip.url.split('/');
                                                const filename = parts[parts.length - 1];
                                                setSelectedVideo(filename);
                                                onTabChange('distribute');
                                            }}
                                        >
                                            <Share2 size={14} />
                                            分发此视频 (Publish/Distribute)
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div style={{ gridColumn: '1 / -1' }}>
                                <EmptyState message="No video clips extracted." Icon={Video} />
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'audio' && (
                    <div style={{ padding: '1rem', height: '100%' }}>
                        {results.audio_url ? (
                            <audio
                                src={getAssetUrl(results.audio_url)}
                                controls
                                className="audio-player"
                                onPlay={handlePlay}
                            />
                        ) : (
                            <EmptyState message="No audio extracted." Icon={Mic} />
                        )}
                    </div>
                )}

                {activeTab === 'recreate' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        {results.tts_config && (
                            <div style={{
                                padding: '1.5rem',
                                background: 'rgba(99, 102, 241, 0.1)',
                                borderRadius: '12px',
                                border: '1px solid rgba(99, 102, 241, 0.2)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <div>
                                    <h4 style={{ margin: '0 0 0.5rem 0', color: '#818cf8' }}>TTS Re-generation</h4>
                                    <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                        Modify settings and re-generate using the original text.
                                    </p>
                                </div>
                                <button
                                    onClick={() => onReGenerate?.(results.tts_config)}
                                    className="btn-primary"
                                    style={{ padding: '0.6rem 1.2rem' }}
                                >
                                    Adjust & Re-generate
                                </button>
                            </div>
                        )}

                        <div style={{ borderTop: results.tts_config ? '1px solid rgba(255,255,255,0.05)' : 'none', paddingTop: results.tts_config ? '2rem' : 0 }}>
                            <h4 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Sparkles size={18} /> AI Video Creator (New Content)
                            </h4>
                            <AIVideoCreator
                                taskId={taskId}
                                contextText={results.subtitles}
                                llmSettings={llmSettings}
                                onTaskCreated={onTaskCreated}
                            />
                        </div>
                    </div>
                )}

                {activeTab === 'distribute' && (
                    <div className="distribute-container" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', padding: '1rem' }}>
                        <div className="distribute-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1rem' }}>
                            <h2 style={{ margin: 0, fontSize: '1.6rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <Share2 size={24} color="var(--accent-primary)" />
                                多平台视频发布分发
                            </h2>
                            <p style={{ margin: '0.5rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                                自动通过 flowauto 执行发布流程。请先配置好 `flowauto/conofig.json` 并在下方输入分享文案。
                            </p>
                        </div>

                        {loadingConfig ? (
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
                                <Loader2 className="spinner" size={32} />
                                <span style={{ marginLeft: '10px' }}>加载分发配置中...</span>
                            </div>
                        ) : platforms.length === 0 ? (
                            <div style={{ padding: '2rem', background: 'rgba(255,0,0,0.05)', border: '1px solid rgba(255,0,0,0.1)', borderRadius: '8px', textAlign: 'center' }}>
                                <p style={{ margin: 0, color: '#fca5a5' }}>
                                    未在 `flowauto/conofig.json` 中找到任何分发平台配置。请检查该配置文件是否存在或格式是否正确。
                                </p>
                              </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                {/* Shared parameters input */}
                                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: '#fff' }}>1. 填写发布内容 (所有平台共用)</h3>
                                    
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                                发布标题/文案 (用于 --title 参数等)
                                            </label>
                                            <textarea
                                                className="textarea-styled"
                                                style={{ minHeight: '120px', background: 'rgba(0,0,0,0.2)' }}
                                                placeholder="输入发布视频时的标题或分享文案..."
                                                value={sharedText}
                                                onChange={(e) => setSharedText(e.target.value)}
                                            />
                                        </div>

                                        {results.video_clips && results.video_clips.length > 1 && (
                                            <div>
                                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                                    选择要分发的视频
                                                </label>
                                                <select
                                                    value={selectedVideo}
                                                    onChange={(e) => setSelectedVideo(e.target.value)}
                                                    style={{
                                                        width: '100%',
                                                        padding: '0.75rem',
                                                        background: 'rgba(0,0,0,0.2)',
                                                        border: '1px solid rgba(255,255,255,0.1)',
                                                        borderRadius: '8px',
                                                        color: '#fff',
                                                        outline: 'none'
                                                    }}
                                                >
                                                    {results.video_clips.map((clip, i) => {
                                                        const parts = clip.url.split('/');
                                                        const filename = parts[parts.length - 1];
                                                        return (
                                                            <option key={i} value={filename} style={{ background: '#1e1e24' }}>
                                                                {clip.title} ({filename})
                                                            </option>
                                                        );
                                                    })}
                                                </select>
                                            </div>
                                        )}
                                        {currentLocalPath && (
                                            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                                                视频本地路径: <code style={{ color: '#a7f3d0', wordBreak: 'break-all' }}>{currentLocalPath}</code>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Platform selection and action grid */}
                                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
                                        <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>2. 选择发布平台</h3>
                                        <button
                                            className="btn-primary"
                                            disabled={publishing || selectedPlatforms.length === 0}
                                            onClick={() => handlePublish(selectedPlatforms)}
                                            style={{
                                                padding: '0.5rem 1.2rem',
                                                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                                border: 'none',
                                                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)'
                                            }}
                                        >
                                            {publishing ? '正在提交...' : '一键分发选中平台'}
                                        </button>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.2rem' }}>
                                        {platforms.map((p, idx) => {
                                            const isSelected = selectedPlatforms.includes(p.platform);
                                            const status = distributeStatus[p.platform] || { state: 'idle' };
                                            
                                            return (
                                                <div
                                                    key={idx}
                                                    style={{
                                                        background: isSelected ? 'rgba(59, 130, 246, 0.05)' : 'rgba(255,255,255,0.01)',
                                                        border: `1px solid ${isSelected ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255,255,255,0.05)'}`,
                                                        borderRadius: '10px',
                                                        padding: '1.2rem',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        justifyContent: 'space-between',
                                                        gap: '1rem',
                                                        transition: 'all 0.2s hover'
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                        <div
                                                            style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }}
                                                            onClick={() => handleToggleSelect(p.platform)}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                onChange={() => {}} // Handled by outer div click
                                                                style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                                                            />
                                                            <span style={{ fontWeight: 600, color: '#fff', fontSize: '1.1rem' }}>{p.platform}</span>
                                                        </div>
                                                        <div>
                                                            {status.state === 'running' && (
                                                                <span style={{ fontSize: '0.85rem', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                    <Loader2 size={14} className="spinner" /> 发布中...
                                                                </span>
                                                            )}
                                                            {status.state === 'completed' && (
                                                                <span style={{ fontSize: '0.85rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                    <CheckCircle2 size={14} /> 已发布
                                                                </span>
                                                            )}
                                                            {status.state === 'error' && (
                                                                <span style={{ fontSize: '0.85rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: '4px' }} title={status.error || ''}>
                                                                    <AlertCircle size={14} /> 失败
                                                                </span>
                                                            )}
                                                            {status.state === 'idle' && (
                                                                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>待发布</span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                        <div>配置: <code style={{ color: '#818cf8' }}>{p.json}</code></div>
                                                        {p.userDataDir && (
                                                            <div>用户目录: <code style={{ color: '#818cf8' }}>{p.userDataDir}</code></div>
                                                        )}
                                                        
                                                        {/* Parameters Preview */}
                                                        <div style={{
                                                            background: 'rgba(0,0,0,0.2)',
                                                            padding: '0.6rem 0.8rem',
                                                            borderRadius: '6px',
                                                            border: '1px solid rgba(255,255,255,0.03)',
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            gap: '0.3rem',
                                                            marginTop: '0.2rem'
                                                        }}>
                                                            <strong style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '3px', marginBottom: '2px', display: 'block' }}>
                                                                参数预览:
                                                            </strong>
                                                            {p.params.map((pm, pIdx) => {
                                                                let displayVal = pm.value;
                                                                if (pm.key.toLowerCase() === 'filepath') {
                                                                    displayVal = currentLocalPath;
                                                                } else if (pm.key.toLowerCase() === 'title') {
                                                                    displayVal = sharedText;
                                                                }
                                                                return (
                                                                    <div key={pIdx} style={{ fontSize: '0.78rem', display: 'flex', gap: '0.4rem', justifyContent: 'space-between' }}>
                                                                        <span style={{ color: 'var(--text-secondary)', flexShrink: 0 }} title={pm.desc}>{pm.desc || pm.key}:</span>
                                                                        <span style={{ color: '#a7f3d0', wordBreak: 'break-all', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }} title={displayVal}>
                                                                            {displayVal || '(空)'}
                                                                        </span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>

                                                    <div style={{ display: 'flex', gap: '0.8rem', marginTop: '0.5rem' }}>
                                                        <button
                                                            className="btn-primary"
                                                            disabled={status.state === 'running' || publishing}
                                                            onClick={() => handlePublish([p.platform])}
                                                            style={{
                                                                flex: 1,
                                                                padding: '0.5rem 1rem',
                                                                fontSize: '0.85rem',
                                                                cursor: 'pointer',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                gap: '0.4rem',
                                                                borderRadius: '8px'
                                                            }}
                                                        >
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <line x1="22" y1="2" x2="11" y2="13"></line>
                                                                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                                                            </svg>
                                                            立即发布
                                                        </button>
                                                        {status.state !== 'idle' && (
                                                            <button
                                                                className={`btn-secondary ${showLogPlatform === p.platform ? 'active' : ''}`}
                                                                onClick={() => handleFetchLog(p.platform)}
                                                                style={{
                                                                    padding: '0.5rem 1rem',
                                                                    fontSize: '0.85rem',
                                                                    cursor: 'pointer',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    gap: '0.4rem',
                                                                    borderRadius: '8px'
                                                                }}
                                                            >
                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                                                    <polyline points="14 2 14 8 20 8"></polyline>
                                                                    <line x1="16" y1="13" x2="8" y2="13"></line>
                                                                    <line x1="16" y1="17" x2="8" y2="17"></line>
                                                                </svg>
                                                                日志
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Logs Section */}
                                {showLogPlatform && (
                                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                                            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>平台 [{showLogPlatform}] 发布日志</h3>
                                            <button
                                                className="btn-secondary"
                                                onClick={() => setShowLogPlatform(null)}
                                                style={{ padding: '0.2rem 0.6rem', fontSize: '0.8rem', cursor: 'pointer' }}
                                            >
                                                关闭
                                            </button>
                                        </div>
                                        <pre style={{
                                            margin: 0,
                                            padding: '1rem',
                                            background: '#0a0a0c',
                                            borderRadius: '6px',
                                            color: '#d4d4d8',
                                            fontFamily: 'monospace',
                                            fontSize: '0.9rem',
                                            maxHeight: '300px',
                                            overflowY: 'auto',
                                            whiteSpace: 'pre-wrap'
                                        }}>
                                            {logs[showLogPlatform] || '正在加载日志...'}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
