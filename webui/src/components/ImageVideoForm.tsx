import React, { useState, useEffect } from 'react';
import { X, Play, Image as ImageIcon } from 'lucide-react';
import type { TTSOptions } from '../api';

interface ImageVideoFormProps {
    onGenerate: (options: TTSOptions, image: File) => void;
    disabled?: boolean;
}

export const ImageVideoForm: React.FC<ImageVideoFormProps> = ({
    onGenerate,
    disabled
}) => {
    const [image, setImage] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const [text, setText] = useState(() => {
        return localStorage.getItem('image-video-text-raw') || "";
    });

    useEffect(() => {
        localStorage.setItem('image-video-text-raw', text);
    }, [text]);

    const [ttsEngine, setTtsEngine] = useState("edge");
    const [voice, setVoice] = useState("zh-CN-XiaoxiaoNeural");
    const [coverTitle, setCoverTitle] = useState("");

    // Advanced TTS settings
    const [temperature, setTemperature] = useState(0.3);
    const [topP, setTopP] = useState(0.7);
    const [topK, setTopK] = useState(20);
    const [speed, setSpeed] = useState(5);
    const [refineText, setRefineText] = useState(true);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0]
            setImage(file);
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
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
            setImage(files[0]);
            setPreviewUrl(URL.createObjectURL(files[0]));
        }
    };

    const removeImage = () => {
        setImage(null);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!image || !text.trim()) return;

        onGenerate({
            text,
            ttsEngine,
            voice,
            temperature,
            top_p: topP,
            top_k: topK,
            speed,
            refine_text: refineText,
            coverTitle
        }, image);
    };

    return (
        <form className="config-form" onSubmit={handleSubmit}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>图文转视频 (Image to Video)</h2>

            <div className="form-group grid" style={{ gridTemplateColumns: '1fr' }}>
                {/* <label>选择一张图片</label> */}
                {!previewUrl ? (
                    <div
                        style={{ position: 'relative' }}
                        className={`upload-zone ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
                        onDragOver={(e) => { e.preventDefault(); }}
                        onDrop={handleDrop}
                        onClick={() => { document.getElementById('image-upload')?.click(); }}
                    >
                        <ImageIcon className="upload-icon mx-auto" />
                        <div className="upload-text">点击或拖拽图片到此处</div>
                        <div className="upload-hint">支持 JPG, PNG</div>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                            disabled={disabled}
                            className="hidden"
                            style={{ display: 'none' }}
                            id="image-upload"
                        />
                    </div>
                ) : (
                    <div style={{ position: 'relative', display: 'inline-block', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', maxWidth: '300px' }}>
                        <img src={previewUrl} alt="Preview" style={{ width: '100%', display: 'block' }} />
                        <div

                            className="icon-btn-secondary"
                            title="移除图片"
                            style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.6)' }}
                            onClick={removeImage}
                            disabled={disabled}
                        >
                            <X size={16} />
                        </div>
                    </div>
                )}
            </div>

            <div className="form-group">
                <label>文案内容 (将生成为配音和字幕)</label>
                <textarea
                    placeholder="请输入视频配音文案..."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    required
                    disabled={disabled}
                    style={{
                        width: '100%',
                        minHeight: '150px',
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

            <div className="form-group">
                <label>封面标题 (选填)</label>
                <input
                    type="text"
                    placeholder="选填：如填入标题，将在开头呈现基于底图的专场封面帧..."
                    value={coverTitle}
                    onChange={(e) => setCoverTitle(e.target.value)}
                    disabled={disabled}
                    style={{
                        width: '100%',
                        padding: '0.8rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        background: 'rgba(0,0,0,0.3)',
                        color: 'var(--text-primary)',
                        outline: 'none',
                        fontSize: '1rem',
                    }}
                />
            </div>

            <div className="form-group grid">
                <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>TTS 引擎</label>
                    <select
                        value={ttsEngine}
                        onChange={(e) => setTtsEngine(e.target.value)}
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
                    >
                        <option value="edge">Edge TTS</option>
                        <option value="omnivoice">OmniVoice (小米星辰)</option>
                        <option value="chattts">ChatTTS</option>
                        <option value="kokoro">Kokoro</option>
                    </select>
                </div>
                <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>配音角色</label>
                    {ttsEngine === "edge" ? (
                        <select
                            value={voice}
                            onChange={(e) => setVoice(e.target.value)}
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
                        >
                            <option value="zh-CN-XiaoxiaoNeural">晓晓 (女)</option>
                            <option value="zh-CN-YunxiNeural">云希 (男)</option>
                            <option value="zh-CN-YunjianNeural">云健 (男)</option>
                            <option value="zh-CN-XiaoyiNeural">晓伊 (女)</option>
                        </select>
                    ) : ttsEngine === "kokoro" ? (
                        <select
                            value={voice}
                            onChange={(e) => setVoice(e.target.value)}
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
                        >
                            <option value="af_heart">af_heart (默认)</option>
                            <option value="af_alloy">af_alloy</option>
                            <option value="am_adam">am_adam</option>
                        </select>
                    ) : ttsEngine === "omnivoice" ? (
                        <select
                            value={voice}
                            onChange={(e) => setVoice(e.target.value)}
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
                        >
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
                        <input
                            type="text"
                            value={voice}
                            onChange={(e) => setVoice(e.target.value)}
                            placeholder="自定义Voice/风格指令"
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
            </div>

            {/* Advanced TTS Settings (same as TTSVideoForm) */}
            <details style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 500, userSelect: 'none' }}>高级配置 (ChatTTS/OmniVoice)</summary>
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
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Speed (速度)</label>
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

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px', fontSize: '1rem', justifyContent: 'center' }} disabled={disabled || !image || !text.trim()}>
                <Play size={18} />
                开始生成图文视频
            </button>
        </form>
    );
};
