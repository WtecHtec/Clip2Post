import React, { useState, useEffect } from 'react';
import { Type, Play, X, Image as ImageIcon } from 'lucide-react';
import type { TTSOptions } from '../api';

interface TTSVideoFormProps {
    onGenerate: (options: TTSOptions) => void;
    disabled?: boolean;
    initialText?: string;
    initialOptions?: Partial<TTSOptions>;
    submitLabel?: string;
}

export const TTSVideoForm: React.FC<TTSVideoFormProps> = ({
    onGenerate,
    disabled,
    initialText = '',
    initialOptions,
    submitLabel = 'Generate Video'
}) => {
    const [text, setText] = useState(() => {
        if (initialText) return initialText;
        return localStorage.getItem('tts-video-text-raw') || '';
    });

    useEffect(() => {
        localStorage.setItem('tts-video-text-raw', text);
    }, [text]);

    const [ttsEngine, setTtsEngine] = useState('edge');
    const [voice, setVoice] = useState('');
    const [preset, setPreset] = useState('default');
    const [refineText, setRefineText] = useState(true);
    const [coverTitle, setCoverTitle] = useState('');
    const [coverImage, setCoverImage] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [bgm, setBgm] = useState<string>('');
    const [bgmList, setBgmList] = useState<string[]>([]);

    useEffect(() => {
        import('../api').then(mod => mod.getBgms().then(setBgmList));
    }, []);

    const selectImage = (file: File) => {
        setCoverImage(file);
        setPreviewUrl(prev => {
            if (prev) URL.revokeObjectURL(prev);
            return URL.createObjectURL(file);
        });
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            selectImage(e.target.files[0]);
        }
    };

    const preventDefaults = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        preventDefaults(e);
        if (disabled) return;
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0 && files[0].type.startsWith("image/")) {
            selectImage(files[0]);
        }
    };

    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            if (disabled) return;
            const files = e.clipboardData?.files;
            if (files && files.length > 0) {
                const imageFile = Array.from(files).find(f => f.type.startsWith('image/'));
                if (imageFile) {
                    selectImage(imageFile);
                    e.preventDefault();
                }
            }
        };

        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [disabled]);

    const removeImage = (e?: React.MouseEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        setCoverImage(null);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
    };

    // Advanced parameters
    const [temperature, setTemperature] = useState(0.3);
    const [topP, setTopP] = useState(0.7);
    const [topK, setTopK] = useState(20);
    const [speed, setSpeed] = useState(1.0);

    useEffect(() => {
        if (initialText) setText(initialText);
    }, [initialText]);

    useEffect(() => {
        if (initialOptions) {
            if (initialOptions.text) setText(initialOptions.text);
            if (initialOptions.ttsEngine) setTtsEngine(initialOptions.ttsEngine);
            if (initialOptions.voice !== undefined) setVoice(initialOptions.voice);
            if (initialOptions.temperature !== undefined) setTemperature(initialOptions.temperature);
            if (initialOptions.top_p !== undefined) setTopP(initialOptions.top_p);
            if (initialOptions.top_k !== undefined) setTopK(initialOptions.top_k);
            if (initialOptions.speed !== undefined) setSpeed(initialOptions.speed);
            if (initialOptions.refine_text !== undefined) setRefineText(initialOptions.refine_text);
            setPreset('custom'); // Default to custom when pre-filling specific params
        }
    }, [initialOptions]);

    const CHATTTS_PRESETS: Record<string, Partial<TTSOptions>> = {
        default: { voice: '2222', temperature: 0.3, top_p: 0.7, top_k: 20, speed: 1.0 },
        mature_male: { voice: '2222', temperature: 0.55, top_p: 0.8, top_k: 20, speed: 0.9 },
        terror: { voice: '6666', temperature: 0.65, top_p: 0.85, top_k: 30, speed: 0.85 },
        comedy: { voice: '8888', temperature: 0.8, top_p: 0.9, top_k: 40, speed: 1.05 },
        storyteller: { voice: '1111', temperature: 0.7, top_p: 0.85, top_k: 30, speed: 0.95 },
        science: { voice: '5555', temperature: 0.6, top_p: 0.8, top_k: 20, speed: 1.0 },
        mystery: { voice: '7777', temperature: 0.65, top_p: 0.85, top_k: 30, speed: 0.9 }
    };

    const handlePresetChange = (p: string) => {
        setPreset(p);
        if (p !== 'custom' && CHATTTS_PRESETS[p]) {
            const settings = CHATTTS_PRESETS[p];
            if (settings.voice !== undefined) setVoice(settings.voice);
            if (settings.temperature !== undefined) setTemperature(settings.temperature);
            if (settings.top_p !== undefined) setTopP(settings.top_p);
            if (settings.top_k !== undefined) setTopK(settings.top_k);
            if (settings.speed !== undefined) setSpeed(settings.speed);
        }
    };

    const handleSubmit = () => {
        if (!text.trim()) return;
        onGenerate({
            text,
            ttsEngine,
            voice,
            temperature,
            top_p: topP,
            top_k: topK,
            speed,
            refine_text: refineText,
            coverTitle,
            coverImage: coverImage || undefined,
            bgm: bgm || undefined
        });
    };

    return (
        <div className="tts-video-form">
            <div style={{ marginBottom: '1.5rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h4 className="section-title" style={{ marginBottom: '1rem', fontSize: '1rem' }}>🖼️ 视频封面设置 (选填)</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>大字标题</label>
                        <input type="text" value={coverTitle} onChange={(e) => setCoverTitle(e.target.value)} placeholder="如填入标题，将在开头呈现专场封面帧..." style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.3)', color: 'var(--text-primary)', outline: 'none' }} />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>封面底图</label>
                        {!previewUrl ? (
                            <div
                                style={{ position: 'relative', marginTop: 0, padding: '1rem', minHeight: '80px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
                                className={`upload-zone ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
                                onDragOver={(e) => { e.preventDefault(); }}
                                onDrop={handleDrop}
                                onClick={() => { document.getElementById('cover-image-upload')?.click(); }}
                            >
                                <ImageIcon className="upload-icon mx-auto" style={{ width: 24, height: 24, marginBottom: 8 }} />
                                <div className="upload-text" style={{ fontSize: '0.8rem' }}>点击、拖拽或粘贴上传封面</div>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageChange}
                                    disabled={disabled}
                                    className="hidden"
                                    style={{ display: 'none' }}
                                    id="cover-image-upload"
                                />
                            </div>
                        ) : (
                            <div style={{ position: 'relative', display: 'inline-block', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', maxWidth: '200px' }}>
                                <img src={previewUrl} alt="Preview" style={{ width: '100%', display: 'block' }} />
                                <div
                                    className="icon-btn-secondary"
                                    title="移除图片"
                                    style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.6)', padding: '4px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    onClick={removeImage}
                                >
                                    <X size={14} color="white" />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div style={{ marginBottom: '1.5rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h4 className="section-title" style={{ marginBottom: '1rem', fontSize: '1rem' }}>🎵 视频背景音乐 (BGM)</h4>
                <div>
                    <select
                        value={bgm}
                        onChange={(e) => setBgm(e.target.value)}
                        style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.3)', color: 'var(--text-primary)', outline: 'none' }}
                    >
                        <option value="">无背景音乐 (None)</option>
                        {bgmList.map(b => (
                            <option key={b} value={b}>{b}</option>
                        ))}
                    </select>
                </div>
            </div>

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
                        <label className="radio-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                            <input
                                type="radio"
                                name="ttsEngine"
                                value="omnivoice"
                                checked={ttsEngine === 'omnivoice'}
                                onChange={() => { setTtsEngine('omnivoice'); setVoice(''); }}
                                style={{ accentColor: 'var(--accent-primary)' }}
                            />
                            <span>OmniVoice (High Quality Zero-Shot)</span>
                        </label>
                        <label className="radio-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                            <input
                                type="radio"
                                name="ttsEngine"
                                value="voxcpm"
                                checked={ttsEngine === 'voxcpm'}
                                onChange={() => { setTtsEngine('voxcpm'); setVoice(''); }}
                                style={{ accentColor: 'var(--accent-primary)' }}
                            />
                            <span>VoxCPM (Tokenizer-Free Local Model)</span>
                        </label>
                    </div>

                    <div style={{ flex: 1, minWidth: '200px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Voice/Seed (Optional)</span>
                            {ttsEngine === 'chattts' && (
                                <button
                                    onClick={() => setVoice(Math.floor(Math.random() * 9999).toString())}
                                    style={{
                                        padding: '0.2rem 0.6rem',
                                        fontSize: '0.75rem',
                                        borderRadius: '4px',
                                        border: '1px solid #6366f1',
                                        background: 'rgba(99, 102, 241, 0.1)',
                                        color: '#818cf8',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Random Seed
                                </button>
                            )}
                        </div>
                        {ttsEngine === 'voxcpm' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '0.5rem', width: '100%' }}>
                                <div style={{ display: 'flex', gap: '1.2rem', marginBottom: '0.2rem' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                                        <input
                                            type="radio"
                                            name="voxcpmMode"
                                            checked={!voice || voice === 'biaoge' || voice === 'boniu' || voice === 'liuxi'}
                                            onChange={() => setVoice('biaoge')}
                                            style={{ accentColor: 'var(--accent-primary)' }}
                                        />
                                        <span>使用预设音色</span>
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                                        <input
                                            type="radio"
                                            name="voxcpmMode"
                                            checked={voice && voice !== 'biaoge' && voice !== 'boniu' && voice !== 'liuxi'}
                                            onChange={() => setVoice('')}
                                            style={{ accentColor: 'var(--accent-primary)' }}
                                        />
                                        <span>自定义音色描述</span>
                                    </label>
                                </div>

                                {(!voice || voice === 'biaoge' || voice === 'boniu' || voice === 'liuxi') ? (
                                    <select
                                        value={voice || 'biaoge'}
                                        onChange={(e) => setVoice(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '0.8rem',
                                            borderRadius: '8px',
                                            border: '1px solid var(--border-color)',
                                            background: 'var(--bg-secondary)',
                                            color: 'var(--text-primary)',
                                            outline: 'none'
                                        }}
                                    >
                                        <option value="biaoge">表哥 — 成熟男性，沉稳磁性</option>
                                        <option value="boniu">波妞 — 成熟男性，播音腔调</option>
                                        <option value="liuxi">柳溪 — 年轻女性，温柔甜美</option>
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        placeholder="如：年轻男性，声音磁性沉稳，语调自然"
                                        value={voice}
                                        onChange={(e) => setVoice(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '0.8rem',
                                            borderRadius: '8px',
                                            border: '1px solid var(--border-color)',
                                            background: 'var(--bg-secondary)',
                                            color: 'var(--text-primary)',
                                            outline: 'none'
                                        }}
                                    />
                                )}
                            </div>
                        ) : (
                            <input
                                type="text"
                                placeholder={ttsEngine === 'kokoro' ? "e.g. af_heart, jm_kama..." : (ttsEngine === 'chattts' ? "Seed number or empty" : (ttsEngine === 'omnivoice' ? "e.g. female, british accent" : (ttsEngine === 'voxcpm' ? "Enter description or path to .wav file" : "e.g. zh-CN-XiaoxiaoNeural...")))}
                                value={voice}
                                onChange={(e) => setVoice(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '0.8rem',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border-color)',
                                    background: 'var(--bg-secondary)',
                                    color: 'var(--text-primary)',
                                    outline: 'none'
                                }}
                            />
                        )}
                        {ttsEngine === 'chattts' && (
                            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                                <div style={{ flex: 1, minWidth: '150px' }}>
                                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>Voice Preset</span>
                                    <select
                                        value={preset}
                                        onChange={(e) => handlePresetChange(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '0.8rem',
                                            borderRadius: '8px',
                                            border: '1px solid var(--border-color)',
                                            background: 'var(--bg-secondary)',
                                            color: 'var(--text-primary)'
                                        }}
                                    >
                                        <option value="default">Default</option>
                                        <option value="mature_male">Mature Male (成熟男声)</option>
                                        <option value="terror">Terror (恐怖类型)</option>
                                        <option value="comedy">Comedy (脱口秀 /搞笑口播)</option>
                                        <option value="storyteller">Storyteller (说书人)</option>
                                        <option value="science">Science (知识科普型)</option>
                                        <option value="mystery">Mystery (悬疑故事型)</option>
                                        <option value="custom">Custom (自定义参数)</option>
                                    </select>
                                </div>
                                <div style={{ flex: 1, minWidth: '150px', display: 'flex', alignItems: 'center', paddingTop: '1.5rem' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                                        <input
                                            type="checkbox"
                                            checked={!refineText}
                                            onChange={(e) => setRefineText(!e.target.checked)}
                                            style={{ accentColor: 'var(--accent-primary)' }}
                                        />
                                        <span>Strictly follow text (Literal mode)</span>
                                    </label>
                                </div>
                            </div>
                        )}

                        {ttsEngine === 'omnivoice' && (
                            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                                <div style={{ flex: 1, minWidth: '150px' }}>
                                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>Voice Style Preset (声音风格预设)</span>
                                    <select
                                        value={voice}
                                        onChange={(e) => setVoice(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '0.8rem',
                                            borderRadius: '8px',
                                            border: '1px solid var(--border-color)',
                                            background: 'var(--bg-secondary)',
                                            color: 'var(--text-primary)'
                                        }}
                                    >
                                        <option value="" disabled>请选择或在上方自定义输入</option>
                                        <option value="女, 青年">女声默认 (女)</option>
                                        <option value="男, 青年">男声默认 (男)</option>
                                        <option value="女，低音调">女声 - 低音 (女，低音调)</option>
                                        <option value="男，低音调">男声 - 低音 (男，低音调)</option>
                                        <option value="女，高音调">女声 - 高音 (女，高音调)</option>
                                        <option value="男，高音调">男声 - 高音 (男，高音调)</option>
                                        <option value="女，东北话">女声 - 东北话 (女，东北话)</option>
                                        <option value="男，东北话">男声 - 东北话 (男，东北话)</option>
                                        <option value="女，四川话">女声 - 四川话 (女，四川话)</option>
                                        <option value="男，四川话">男声 - 四川话 (男，四川话)</option>
                                        <option value="女，耳语">女声 - 耳语 (女，耳语)</option>
                                        <option value="男，耳语">男声 - 耳语 (男，耳语)</option>
                                        <option value="儿童">儿童声 (儿童)</option>
                                        <option value="女，老年">女声 - 老年 (女，老年)</option>
                                        <option value="男，老年">男声 - 老年 (男，老年)</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {ttsEngine === 'chattts' && (
                            <div style={{
                                marginTop: '1rem',
                                padding: '1rem',
                                background: 'rgba(255,255,255,0.02)',
                                borderRadius: '8px',
                                border: '1px solid rgba(255,255,255,0.05)',
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                gap: '1.5rem'
                            }}>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Temperature: {temperature}</span>
                                    </div>
                                    <input
                                        type="range" min="0.0" max="1.0" step="0.05"
                                        value={temperature}
                                        onChange={(e) => { setTemperature(parseFloat(e.target.value)); setPreset('custom'); }}
                                        style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
                                    />
                                </div>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Top P: {topP}</span>
                                    </div>
                                    <input
                                        type="range" min="0.1" max="1.0" step="0.05"
                                        value={topP}
                                        onChange={(e) => { setTopP(parseFloat(e.target.value)); setPreset('custom'); }}
                                        style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
                                    />
                                </div>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Top K: {topK}</span>
                                    </div>
                                    <input
                                        type="range" min="1" max="50" step="1"
                                        value={topK}
                                        onChange={(e) => { setTopK(parseInt(e.target.value)); setPreset('custom'); }}
                                        style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
                                    />
                                </div>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Speed: {speed}</span>
                                    </div>
                                    <input
                                        type="range" min="0.5" max="2.0" step="0.05"
                                        value={speed}
                                        onChange={(e) => { setSpeed(parseFloat(e.target.value)); setPreset('custom'); }}
                                        style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
                                    />
                                </div>
                            </div>
                        )}
                        <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5', padding: '0.8rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', borderLeft: '3px solid var(--accent-primary)' }}>
                            {ttsEngine === 'edge' && (
                                <p style={{ margin: 0 }}>💡 <b>Edge:</b> 输入角色名，如 <i>zh-CN-XiaoxiaoNeural</i> (女), <i>zh-CN-YunxiNeural</i> (男)。</p>
                            )}
                            {ttsEngine === 'chattts' && (
                                <p style={{ margin: 0 }}>
                                    💡 <b>ChatTTS:</b> 输入<b>数字</b>(如 6666)可固定音色。
                                    <br />
                                    <span style={{ color: 'var(--accent-primary)', fontSize: '0.8rem' }}>* 若留空，单次视频生成会随机挑选一个固定音色，但每次生成可能不同。</span>
                                </p>
                            )}
                            {ttsEngine === 'kokoro' && (
                                <p style={{ margin: 0 }}>💡 <b>Kokoro:</b> 输入声音 ID，如 <i>af_heart</i>, <i>am_adam</i>。</p>
                            )}
                            {ttsEngine === 'omnivoice' && (
                                <p style={{ margin: 0 }}>💡 <b>OmniVoice:</b> 输入声音风格，中文如 <i>女，低音调</i>（全角逗号分隔），英文如 <i>female, low pitch</i>。</p>
                            )}
                            {ttsEngine === 'voxcpm' && (
                                <p style={{ margin: 0 }}>💡 <b>VoxCPM:</b> 选择预设音色，或输入自定义音色描述（如"年轻男性，声音沉稳"）来控制音色风格。</p>
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
