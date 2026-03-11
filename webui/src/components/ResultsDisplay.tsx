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
                                <video src={getAssetUrl(results.source_video)} controls style={{ maxHeight: '600px', width: 'auto' }} />
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
                    <div className="video-grid">
                        {results.video_clips && results.video_clips.length > 0 ? (
                            results.video_clips.map((vid, i) => (
                                <div key={i} className="video-item">
                                    <video src={getAssetUrl(vid)} controls />
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
                            <audio src={getAssetUrl(results.audio_url)} controls className="audio-player" />
                        ) : (
                            <EmptyState message="No audio extracted." Icon={Mic} />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
