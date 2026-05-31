import React, { useState, useEffect } from 'react';
import { X, Play, Image as ImageIcon, MessageSquare } from 'lucide-react';
import type { NewsVideoOptions } from '../api';

interface NewsVideoFormProps {
    onGenerate: (options: NewsVideoOptions, image: File) => void;
    disabled?: boolean;
}

export const NewsVideoForm: React.FC<NewsVideoFormProps> = ({
    onGenerate,
    disabled
}) => {
    const [image, setImage] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const [openingHook, setOpeningHook] = useState(() => localStorage.getItem('news-video-opening') || "");
    const [mainText, setMainText] = useState(() => localStorage.getItem('news-video-main') || "");
    const [endingHook, setEndingHook] = useState(() => localStorage.getItem('news-video-ending') || "");
    
    useEffect(() => {
        localStorage.setItem('news-video-opening', openingHook);
        localStorage.setItem('news-video-main', mainText);
        localStorage.setItem('news-video-ending', endingHook);
    }, [openingHook, mainText, endingHook]);

    const [ttsEngine, setTtsEngine] = useState("edge");
    const [voice, setVoice] = useState("zh-CN-XiaoxiaoNeural");
    const [coverTitle, setCoverTitle] = useState("");
    const [endingTitle, setEndingTitle] = useState("");
    const [bgm, setBgm] = useState<string>('');
    const [bgmList, setBgmList] = useState<string[]>([]);

    useEffect(() => {
        import('../api').then(mod => mod.getBgms().then(setBgmList));
    }, []);

    // Advanced TTS settings
    const [temperature, setTemperature] = useState(0.3);
    const [topP, setTopP] = useState(0.7);
    const [topK, setTopK] = useState(20);
    const [speed, setSpeed] = useState(5);
    const [refineText, setRefineText] = useState(true);

    const selectImage = (file: File) => {
        setImage(file);
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

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
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

    const removeImage = () => {
        setImage(null);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!image || !mainText.trim()) return;

        onGenerate({
            openingHook,
            mainText,
            endingHook,
            ttsEngine,
            voice,
            temperature,
            top_p: topP,
            top_k: topK,
            speed,
            refine_text: refineText,
            coverTitle,
            endingTitle,
            bgm: bgm || undefined
        }, image);
    };

    return (
        <form className="config-form" onSubmit={handleSubmit}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>资讯播报 (News Broadcast Video)</h2>

            <div className="form-group grid" style={{ gridTemplateColumns: '1fr' }}>
                {!previewUrl ? (
                    <div
                        style={{ position: 'relative' }}
                        className={`upload-zone ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
                        onDragOver={(e) => { e.preventDefault(); }}
                        onDrop={handleDrop}
                        onClick={() => { document.getElementById('news-image-upload')?.click(); }}
                    >
                        <ImageIcon className="upload-icon mx-auto" />
                        <div className="upload-text">点击、拖拽或粘贴背景图片到此处</div>
                        <div className="upload-hint">支持 JPG, PNG (必填)，或剪贴板图片</div>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                            disabled={disabled}
                            style={{ display: 'none' }}
                            id="news-image-upload"
                        />
                    </div>
                ) : (
                    <div style={{ position: 'relative', display: 'inline-block', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', maxWidth: '300px' }}>
                        <img src={previewUrl} alt="Preview" style={{ width: '100%', display: 'block' }} />
                        <div
                            className="icon-btn-secondary"
                            title="移除图片"
                            style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.6)', cursor: 'pointer' }}
                            onClick={removeImage}
                        >
                            <X size={16} />
                        </div>
                    </div>
                )}
            </div>

            <div className="form-group grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                    <label>封面标题 (选填)</label>
                    <input
                        type="text"
                        placeholder="如填入，将在视频开头展示2秒"
                        value={coverTitle}
                        onChange={(e) => setCoverTitle(e.target.value)}
                        disabled={disabled}
                        style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.3)', color: 'var(--text-primary)', outline: 'none' }}
                    />
                </div>
                <div>
                    <label>结尾标题 (选填)</label>
                    <input
                        type="text"
                        placeholder="如填入，将在视频结尾展示2秒"
                        value={endingTitle}
                        onChange={(e) => setEndingTitle(e.target.value)}
                        disabled={disabled}
                        style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.3)', color: 'var(--text-primary)', outline: 'none' }}
                    />
                </div>
            </div>

            <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <MessageSquare size={16} /> 开头钩子文案 (选填，仅播放声音)
                </label>
                <textarea
                    placeholder="吸引注意力的开头语音..."
                    value={openingHook}
                    onChange={(e) => setOpeningHook(e.target.value)}
                    disabled={disabled}
                    style={{ width: '100%', minHeight: '60px', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'rgba(0,0,0,0.3)', color: 'var(--text-primary)', outline: 'none', resize: 'vertical' }}
                />
            </div>

            <div className="form-group">
                <label style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>正文文案 (必填，将在视频中滚动显示)</label>
                <textarea
                    placeholder="请输入资讯的主体内容..."
                    value={mainText}
                    onChange={(e) => setMainText(e.target.value)}
                    required
                    disabled={disabled}
                    style={{ width: '100%', minHeight: '150px', padding: '1rem', borderRadius: '12px', border: '1px solid var(--accent-primary)', backgroundColor: 'rgba(59, 130, 246, 0.05)', color: 'var(--text-primary)', outline: 'none', resize: 'vertical', fontSize: '1rem', lineHeight: '1.6' }}
                />
            </div>

            <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <MessageSquare size={16} /> 结尾钩子文案 (选填，仅播放声音)
                </label>
                <textarea
                    placeholder="引导点赞关注的结尾语音..."
                    value={endingHook}
                    onChange={(e) => setEndingHook(e.target.value)}
                    disabled={disabled}
                    style={{ width: '100%', minHeight: '60px', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'rgba(0,0,0,0.3)', color: 'var(--text-primary)', outline: 'none', resize: 'vertical' }}
                />
            </div>

            <div className="form-group" style={{ marginBottom: '1.5rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h4 style={{ marginBottom: '1rem', fontSize: '1rem' }}>🎵 视频背景音乐 (BGM)</h4>
                <select
                    value={bgm}
                    onChange={(e) => setBgm(e.target.value)}
                    disabled={disabled}
                    style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.3)', color: 'var(--text-primary)', outline: 'none' }}
                >
                    <option value="">无背景音乐 (None)</option>
                    {bgmList.map(b => (
                        <option key={b} value={b}>{b}</option>
                    ))}
                </select>
            </div>

            <div className="form-group grid">
                <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>TTS 引擎</label>
                    <select
                        value={ttsEngine}
                        onChange={(e) => {
                            const newEngine = e.target.value;
                            setTtsEngine(newEngine);
                            if (newEngine === 'edge') setVoice('zh-CN-XiaoxiaoNeural');
                            else if (newEngine === 'kokoro') setVoice('af_heart');
                            else if (newEngine === 'omnivoice') setVoice('女');
                            else if (newEngine === 'voxcpm') setVoice('A young female, gentle and sweet voice');
                            else setVoice('');
                        }}
                        disabled={disabled}
                        style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-primary)', outline: 'none' }}
                    >
                        <option value="edge">Edge TTS</option>
                        <option value="voxcpm">VoxCPM</option>
                        <option value="omnivoice">OmniVoice (小米星辰)</option>
                        <option value="chattts">ChatTTS</option>
                        <option value="kokoro">Kokoro</option>
                    </select>
                </div>
                <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>配音角色</label>
                    {ttsEngine === "edge" ? (
                        <select value={voice} onChange={(e) => setVoice(e.target.value)} disabled={disabled} style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-primary)', outline: 'none' }}>
                            <option value="zh-CN-XiaoxiaoNeural">晓晓 (女)</option>
                            <option value="zh-CN-YunxiNeural">云希 (男)</option>
                            <option value="zh-CN-YunjianNeural">云健 (男)</option>
                            <option value="zh-CN-XiaoyiNeural">晓伊 (女)</option>
                        </select>
                    ) : ttsEngine === "kokoro" ? (
                        <select value={voice} onChange={(e) => setVoice(e.target.value)} disabled={disabled} style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-primary)', outline: 'none' }}>
                            <option value="af_heart">af_heart (默认)</option>
                            <option value="af_alloy">af_alloy</option>
                            <option value="am_adam">am_adam</option>
                        </select>
                    ) : ttsEngine === "omnivoice" ? (
                        <select value={voice} onChange={(e) => setVoice(e.target.value)} disabled={disabled} style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-primary)', outline: 'none' }}>
                            <option value="女">女声默认 (女)</option>
                            <option value="男">男声默认 (男)</option>
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
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                            {ttsEngine === 'voxcpm' ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', width: '100%' }}>
                                    <div style={{ display: 'flex', gap: '1.2rem', marginBottom: '0.2rem' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                                            <input
                                                type="radio"
                                                name="voxcpmModeNews"
                                                checked={!voice || voice === 'biaoge' || voice === 'boniu' || voice === 'liuxi'}
                                                onChange={() => setVoice('biaoge')}
                                                style={{ accentColor: 'var(--accent-primary)' }}
                                            />
                                            <span>使用预设音色</span>
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                                            <input
                                                type="radio"
                                                name="voxcpmModeNews"
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
                                                background: 'rgba(255, 255, 255, 0.05)',
                                                color: 'var(--text-primary)',
                                                outline: 'none'
                                            }}
                                        >
                                            <option value="biaoge" style={{ background: '#1e1e24', color: 'white' }}>表哥 — 成熟男性，沉稳磁性</option>
                                            <option value="boniu" style={{ background: '#1e1e24', color: 'white' }}>波妞 — 成熟男性，播音腔调</option>
                                            <option value="liuxi" style={{ background: '#1e1e24', color: 'white' }}>柳溪 — 年轻女性，温柔甜美</option>
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
                                                background: 'rgba(255, 255, 255, 0.05)',
                                                color: 'var(--text-primary)',
                                                outline: 'none'
                                            }}
                                        />
                                    )}
                                    <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.6 }}>
                                        💡 <b>VoxCPM:</b> 选择预设音色，或输入自定义音色描述（如"年轻男性，声音沉稳"）来控制音色风格。
                                    </p>
                                </div>
                            ) : (
                                <input
                                    type="text"
                                    value={voice}
                                    onChange={(e) => setVoice(e.target.value)}
                                    placeholder="自定义Voice指令"
                                    disabled={disabled}
                                    style={{
                                        width: '100%',
                                        padding: '0.8rem',
                                        borderRadius: '8px',
                                        border: '1px solid var(--border-color)',
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        color: 'var(--text-primary)',
                                        outline: 'none'
                                    }}
                                />
                            )}
                        </div>
                    )}
                </div>
            </div>

            <details style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 500, userSelect: 'none' }}>高级配置 (ChatTTS/OmniVoice/VoxCPM)</summary>
                <div className="form-group grid" style={{ marginTop: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Temperature</label>
                        <input type="number" step="0.1" value={temperature} onChange={(e) => setTemperature(parseFloat(e.target.value))} disabled={disabled} style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-primary)', outline: 'none' }} />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Top P</label>
                        <input type="number" step="0.1" value={topP} onChange={(e) => setTopP(parseFloat(e.target.value))} disabled={disabled} style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-primary)', outline: 'none' }} />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Top K</label>
                        <input type="number" value={topK} onChange={(e) => setTopK(parseInt(e.target.value))} disabled={disabled} style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-primary)', outline: 'none' }} />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Speed</label>
                        <input type="number" step="0.1" value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value))} disabled={disabled} style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-primary)', outline: 'none' }} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', margin: 0 }}>
                            <input
                                type="checkbox"
                                checked={refineText}
                                onChange={(e) => setRefineText(e.target.checked)}
                                disabled={disabled}
                            />
                            智能修饰文本
                        </label>
                    </div>
                </div>
            </details>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px', fontSize: '1rem', justifyContent: 'center' }} disabled={disabled || !image || !mainText.trim()}>
                <Play size={18} />
                开始生成资讯播报
            </button>
        </form>
    );
};
