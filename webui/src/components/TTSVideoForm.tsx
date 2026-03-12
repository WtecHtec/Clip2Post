import React, { useState } from 'react';
import { Type, Play } from 'lucide-react';
import type { TTSOptions } from '../api';

interface TTSVideoFormProps {
    onGenerate: (options: TTSOptions) => void;
    disabled?: boolean;
    initialText?: string;
    submitLabel?: string;
}

export const TTSVideoForm: React.FC<TTSVideoFormProps> = ({
    onGenerate,
    disabled,
    initialText = '',
    submitLabel = 'Generate Video'
}) => {
    const [text, setText] = useState(initialText);
    const [ttsEngine, setTtsEngine] = useState('edge');
    const [voice, setVoice] = useState('');

    const handleSubmit = () => {
        if (!text.trim()) return;
        onGenerate({
            text,
            ttsEngine,
            voice
        });
    };

    return (
        <div className="tts-video-form">
            <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Type size={20} /> Text Content
                    </h3>
                    {ttsEngine === 'chattts' && (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {[
                                { label: '😊 [laugh]', value: '[laugh]' },
                                { label: '😄 [laughter]', value: '[laughter]' },
                                { label: '⏱️ [uv_break]', value: '[uv_break]' },
                                { label: '💡 [oral_2]', value: '[oral_2]' },
                            ].map(btn => (
                                <button
                                    key={btn.value}
                                    onClick={() => setText(prev => prev + btn.value)}
                                    style={{
                                        padding: '0.3rem 0.6rem',
                                        fontSize: '0.75rem',
                                        borderRadius: '6px',
                                        border: '1px solid var(--border-color)',
                                        backgroundColor: 'rgba(255,255,255,0.05)',
                                        color: 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                                >
                                    {btn.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <textarea
                    placeholder="请输入想要转换成视频的文字内容..."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    style={{
                        width: '100%',
                        minHeight: '200px',
                        padding: '1rem',
                        borderRadius: '12px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'rgba(0,0,0,0.3)',
                        color: 'var(--text-primary)',
                        fontSize: '1rem',
                        lineHeight: '1.6',
                        outline: 'none',
                        resize: 'vertical'
                    }}
                />
            </div>

            <div className="option-section">
                <h4 className="section-title">🎙️ TTS Settings</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', marginTop: '1rem' }}>
                    <div className="radio-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.2rem', display: 'block' }}>Engine</span>
                        <label className="radio-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                            <input
                                type="radio"
                                name="ttsEngine"
                                value="edge"
                                checked={ttsEngine === 'edge'}
                                onChange={() => { setTtsEngine('edge'); setVoice(''); }}
                                style={{ accentColor: 'var(--accent-primary)' }}
                            />
                            <span>Edge TTS (Fast & Online)</span>
                        </label>
                        <label className="radio-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                            <input
                                type="radio"
                                name="ttsEngine"
                                value="kokoro"
                                checked={ttsEngine === 'kokoro'}
                                onChange={() => { setTtsEngine('kokoro'); setVoice(''); }}
                                style={{ accentColor: 'var(--accent-primary)' }}
                            />
                            <span>Kokoro-82M (High Quality & Local)</span>
                        </label>
                        <label className="radio-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                            <input
                                type="radio"
                                name="ttsEngine"
                                value="chattts"
                                checked={ttsEngine === 'chattts'}
                                onChange={() => { setTtsEngine('chattts'); setVoice(''); }}
                                style={{ accentColor: 'var(--accent-primary)' }}
                            />
                            <span>ChatTTS (Natural Conversational)</span>
                        </label>
                    </div>

                    <div style={{ flex: 1, minWidth: '200px' }}>
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'block' }}>Voice/Seed (Optional)</span>
                        <input
                            type="text"
                            placeholder={ttsEngine === 'kokoro' ? "e.g. af_heart, jm_kama..." : (ttsEngine === 'chattts' ? "Seed number or empty" : "e.g. zh-CN-XiaoxiaoNeural...")}
                            value={voice}
                            onChange={(e) => setVoice(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '0.6rem 0.8rem',
                                borderRadius: '8px',
                                border: '1px solid var(--border-color)',
                                backgroundColor: 'rgba(0,0,0,0.2)',
                                color: 'var(--text-primary)',
                                outline: 'none'
                            }}
                        />
                        <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                            {ttsEngine === 'edge' && (
                                <p>💡 <b>Edge:</b> 输入角色名，如 <i>zh-CN-XiaoxiaoNeural</i> (女), <i>zh-CN-YunxiNeural</i> (男)。</p>
                            )}
                            {ttsEngine === 'chattts' && (
                                <p>💡 <b>ChatTTS:</b> 输入任意<b>数字</b>作为 Seed 以固定音色（如 2222, 6666）。</p>
                            )}
                            {ttsEngine === 'kokoro' && (
                                <p>💡 <b>Kokoro:</b> 输入声音 ID，如 <i>af_heart</i>, <i>am_adam</i>。</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ marginTop: '2.5rem', textAlign: 'center' }}>
                <button
                    className="btn-primary"
                    onClick={handleSubmit}
                    disabled={disabled || !text.trim()}
                    style={{ width: '100%', marginTop: '1.5rem' }}
                >
                    {submitLabel}
                    <Play size={18} fill="currentColor" />
                </button>
            </div>
        </div >
    );
};
