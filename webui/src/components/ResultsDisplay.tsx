import React from 'react';
import classNames from 'classnames';
import { FileText, Image as ImageIcon, Layout, Video, Mic, Film } from 'lucide-react';
import { getAssetUrl } from '../api';
import type { TaskResults } from '../api';

interface ResultsDisplayProps {
    results: TaskResults;
    activeTab: 'subtitles' | 'markdown' | 'images' | 'html' | 'videos' | 'audio' | 'source';
    onTabChange: (tab: 'subtitles' | 'markdown' | 'images' | 'html' | 'videos' | 'audio' | 'source') => void;
}

export const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ results, activeTab, onTabChange }) => {
    const activeMediaRef = React.useRef<HTMLVideoElement | HTMLAudioElement | null>(null);

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
            </div>
        </div>
    );
};
