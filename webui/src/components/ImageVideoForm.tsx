import React, { useState, useEffect } from 'react';
import { X, Play, Image as ImageIcon } from 'lucide-react';
import { getAssetUrl } from '../api';
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
    // OmniVoice: 'instruct' = style, 'clone' = voice cloning
    const [omnivoiceMode, setOmnivoiceMode] = useState<'instruct' | 'clone'>('instruct');
    const [omnivoiceCloneSource, setOmnivoiceCloneSource] = useState<'preset' | 'upload'>('preset');
    const [coverTitle, setCoverTitle] = useState("");
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
            coverTitle,
            bgm: bgm || undefined
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
                        <div className="upload-text">点击、拖拽或粘贴图片到此处</div>
                        <div className="upload-hint">支持 JPG, PNG，或剪贴板图片</div>
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

            <div className="form-group" style={{ marginBottom: '1.5rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h4 style={{ marginBottom: '1rem', fontSize: '1rem' }}>🎵 视频背景音乐 (BGM)</h4>
                <div>
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
                    {bgm && (
                        <div style={{ 
                            marginTop: '0.8rem', 
                            padding: '0.6rem', 
                            background: 'rgba(255, 255, 255, 0.02)', 
                            borderRadius: '8px', 
                            border: '1px solid rgba(255, 255, 255, 0.05)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.4rem'
                        }}>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span>🎧 预听背景音乐:</span>
                                <span style={{ color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '250px' }} title={bgm}>
                                    {bgm}
                                </span>
                            </div>
                            <audio
                                key={bgm}
                                src={getAssetUrl(`/bgm/${bgm}`)}
                                controls
                                style={{ width: '100%', height: '36px' }}
                            />
                        </div>
                    )}
                </div>
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
                        <option value="voxcpm">VoxCPM</option>
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', width: '100%' }}>
                            {/* Mode selector */}
                            <div style={{ display: 'flex', gap: '1.2rem', marginBottom: '0.2rem' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                                    <input
                                        type="radio"
                                        name="omnivoiceModeImage"
                                        checked={omnivoiceMode !== 'clone'}
                                        onChange={() => { setOmnivoiceMode('instruct'); setVoice('女'); }}
                                        style={{ accentColor: 'var(--accent-primary)' }}
                                    />
                                    <span>风格指令</span>
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                                    <input
                                        type="radio"
                                        name="omnivoiceModeImage"
                                        checked={omnivoiceMode === 'clone'}
                                        onChange={() => { setOmnivoiceMode('clone'); setOmnivoiceCloneSource('preset'); setVoice('biaoge'); }}
                                        style={{ accentColor: 'var(--accent-primary)' }}
                                    />
                                    <span>克隆参考音频</span>
                                </label>
                            </div>

                            {omnivoiceMode !== 'clone' ? (
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
                                    <option value="女" style={{ background: '#1e1e24', color: 'white' }}>女声默认 (女)</option>
                                    <option value="男" style={{ background: '#1e1e24', color: 'white' }}>男声默认 (男)</option>
                                    <option value="女，低音调" style={{ background: '#1e1e24', color: 'white' }}>女声 - 低音 (女，低音调)</option>
                                    <option value="男，低音调" style={{ background: '#1e1e24', color: 'white' }}>男声 - 低音 (男，低音调)</option>
                                    <option value="女，高音调" style={{ background: '#1e1e24', color: 'white' }}>女声 - 高音 (女，高音调)</option>
                                    <option value="男，高音调" style={{ background: '#1e1e24', color: 'white' }}>男声 - 高音 (男，高音调)</option>
                                    <option value="女，东北话" style={{ background: '#1e1e24', color: 'white' }}>女声 - 东北话 (女，东北话)</option>
                                    <option value="男，东北话" style={{ background: '#1e1e24', color: 'white' }}>男声 - 东北话 (男，东北话)</option>
                                    <option value="女，四川话" style={{ background: '#1e1e24', color: 'white' }}>女声 - 四川话 (女，四川话)</option>
                                    <option value="男，四川话" style={{ background: '#1e1e24', color: 'white' }}>男声 - 四川话 (男，四川话)</option>
                                    <option value="女，耳语" style={{ background: '#1e1e24', color: 'white' }}>女声 - 耳语 (女，耳语)</option>
                                    <option value="男，耳语" style={{ background: '#1e1e24', color: 'white' }}>男声 - 耳语 (男，耳语)</option>
                                    <option value="儿童" style={{ background: '#1e1e24', color: 'white' }}>儿童声 (儿童)</option>
                                    <option value="女，老年" style={{ background: '#1e1e24', color: 'white' }}>女声 - 老年 (女，老年)</option>
                                    <option value="男，老年" style={{ background: '#1e1e24', color: 'white' }}>男声 - 老年 (男，老年)</option>
                                </select>
                            ) : (
                                /* Voice cloning — choose preset or upload custom WAV reference file */
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', width: '100%' }}>
                                    {/* Sub-mode selector */}
                                    <div style={{ display: 'flex', gap: '1.2rem', marginBottom: '0.2rem' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                                            <input
                                                type="radio"
                                                name="omnivoiceCloneSourceImage"
                                                checked={omnivoiceCloneSource === 'preset'}
                                                onChange={() => { setOmnivoiceCloneSource('preset'); setVoice('biaoge'); }}
                                                style={{ accentColor: 'var(--accent-primary)' }}
                                            />
                                            <span>使用预设音频</span>
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                                            <input
                                                type="radio"
                                                name="omnivoiceCloneSourceImage"
                                                checked={omnivoiceCloneSource === 'upload'}
                                                onChange={() => { setOmnivoiceCloneSource('upload'); setVoice(''); }}
                                                style={{ accentColor: 'var(--accent-primary)' }}
                                            />
                                            <span>自定义上传音频</span>
                                        </label>
                                    </div>

                                    {omnivoiceCloneSource === 'preset' ? (
                                        /* Preset selector */
                                        <select
                                            value={voice || 'biaoge'}
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
                                            <option value="biaoge" style={{ background: '#1e1e24', color: 'white' }}>表哥 — 成熟男性，沉稳磁性 (biaoge.wav)</option>
                                            <option value="boniu" style={{ background: '#1e1e24', color: 'white' }}>波妞 — 成熟男性，播音腔调 (boniu.wav)</option>
                                            <option value="liuxi" style={{ background: '#1e1e24', color: 'white' }}>柳溪 — 年轻女性，温柔甜美 (liuxi.wav)</option>
                                        </select>
                                    ) : (
                                        /* WAV upload */
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                            <input
                                                type="text"
                                                placeholder="参考音频路径（上传 WAV 后自动填写）"
                                                value={voice}
                                                readOnly
                                                style={{
                                                    width: '100%',
                                                    padding: '0.8rem',
                                                    borderRadius: '8px',
                                                    border: '1px solid var(--border-color)',
                                                    background: 'rgba(255, 255, 255, 0.02)',
                                                    color: 'var(--text-secondary, #ccc)',
                                                    outline: 'none',
                                                    cursor: 'default'
                                                }}
                                            />
                                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                <button
                                                    type="button"
                                                    disabled={disabled}
                                                    onClick={() => document.getElementById('omnivoice-file-upload-image')?.click()}
                                                    style={{
                                                        padding: '0.8rem 1.4rem',
                                                        borderRadius: '8px',
                                                        background: 'var(--accent-primary, #6366f1)',
                                                        color: '#fff',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        fontSize: '0.85rem',
                                                        fontWeight: 600
                                                    }}
                                                >
                                                    📂 上传参考 WAV
                                                </button>
                                                {voice && (
                                                    <span style={{ fontSize: '0.8rem', color: '#10b981' }}>
                                                        ✅ {voice.split('/').pop()}
                                                    </span>
                                                )}
                                                <input
                                                    id="omnivoice-file-upload-image"
                                                    type="file"
                                                    accept=".wav"
                                                    style={{ display: 'none' }}
                                                    onChange={async (e) => {
                                                        const file = e.target.files?.[0];
                                                        if (!file) return;
                                                        const formData = new FormData();
                                                        formData.append('file', file);
                                                        try {
                                                            const response = await fetch('/api/upload_voice', {
                                                                method: 'POST',
                                                                body: formData
                                                            });
                                                            const data = await response.json();
                                                            if (data.success) {
                                                                setVoice(data.absolute_path);
                                                            } else {
                                                                alert(`上传失败: ${data.error || '未知错误'}`);
                                                            }
                                                        } catch (err) {
                                                            alert(`网络请求失败: ${err}`);
                                                        }
                                                    }}
                                                />
                                            </div>
                                            <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.6 }}>
                                                上传一段 WAV 参考音频，OmniVoice 将自动用 Whisper 识别参考文字，无需手动输入。
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                            {ttsEngine === 'voxcpm' ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', width: '100%' }}>
                                    <div style={{ display: 'flex', gap: '1.2rem', marginBottom: '0.2rem' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                                            <input
                                                type="radio"
                                                name="voxcpmModeImage"
                                                checked={!voice || voice === 'biaoge' || voice === 'boniu' || voice === 'liuxi'}
                                                onChange={() => setVoice('biaoge')}
                                                style={{ accentColor: 'var(--accent-primary)' }}
                                            />
                                            <span>使用预设音色</span>
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                                            <input
                                                type="radio"
                                                name="voxcpmModeImage"
                                                checked={!!voice && voice !== 'biaoge' && voice !== 'boniu' && voice !== 'liuxi'}
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
                    )}
                </div>
            </div>

            {/* Advanced TTS Settings (same as TTSVideoForm) */}
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
