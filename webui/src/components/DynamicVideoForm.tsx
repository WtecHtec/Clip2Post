import React, { useState, useEffect } from 'react';
import { Type, Play, MessageSquare, Sparkles, Image, Plus, Trash2, Camera } from 'lucide-react';
import type { DynamicVideoOptions } from '../api';

interface DynamicVideoFormProps {
    onGenerate: (options: DynamicVideoOptions) => void;
    disabled?: boolean;
    initialPrompt?: string;
    initialOptions?: Partial<DynamicVideoOptions>;
    submitLabel?: string;
}

export const DynamicVideoForm: React.FC<DynamicVideoFormProps> = ({
    onGenerate,
    disabled,
    initialPrompt = '帮我生成一期关于AI和人工智能的视频',
    initialOptions,
    submitLabel = 'Generate Dynamic Video'
}) => {
    const [prompt, setPrompt] = useState(() => {
        const cached = localStorage.getItem('dynamic-video-prompt');
        return cached || initialPrompt || '帮我生成一期关于AI和人工智能的视频';
    });

    const [ttsEngine, setTtsEngine] = useState(() => localStorage.getItem('dynamic-video-ttsEngine') || 'edge');
    const [voice, setVoice] = useState(() => localStorage.getItem('dynamic-video-voice') || '');
    const [preset, setPreset] = useState(() => localStorage.getItem('dynamic-video-preset') || 'default');
    const [refineText, setRefineText] = useState(() => localStorage.getItem('dynamic-video-refineText') === 'false' ? false : true);
    const [bgm, setBgm] = useState<string>(() => localStorage.getItem('dynamic-video-bgm') || '');
    const [bgmList, setBgmList] = useState<string[]>([]);

    // Advanced parameters
    const [temperature, setTemperature] = useState(() => parseFloat(localStorage.getItem('dynamic-video-temperature') || '0.3'));
    const [topP, setTopP] = useState(() => parseFloat(localStorage.getItem('dynamic-video-topP') || '0.7'));
    const [topK, setTopK] = useState(() => parseInt(localStorage.getItem('dynamic-video-topK') || '20'));
    const [speed, setSpeed] = useState(() => parseFloat(localStorage.getItem('dynamic-video-speed') || '1.0'));
    const [maxRetries, setMaxRetries] = useState(() => parseInt(localStorage.getItem('dynamic-video-maxRetries') || '1'));
    const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9'>(() => (localStorage.getItem('dynamic-video-aspectRatio') as '9:16' | '16:9') || '9:16');
    const [userImages, setUserImages] = useState<{ file: File; description: string }[]>([]);

    useEffect(() => {
        localStorage.setItem('dynamic-video-prompt', prompt);
        localStorage.setItem('dynamic-video-ttsEngine', ttsEngine);
        localStorage.setItem('dynamic-video-voice', voice);
        localStorage.setItem('dynamic-video-preset', preset);
        localStorage.setItem('dynamic-video-refineText', refineText.toString());
        localStorage.setItem('dynamic-video-bgm', bgm);
        localStorage.setItem('dynamic-video-temperature', temperature.toString());
        localStorage.setItem('dynamic-video-topP', topP.toString());
        localStorage.setItem('dynamic-video-topK', topK.toString());
        localStorage.setItem('dynamic-video-speed', speed.toString());
        localStorage.setItem('dynamic-video-maxRetries', maxRetries.toString());
        localStorage.setItem('dynamic-video-aspectRatio', aspectRatio);
    }, [prompt, ttsEngine, voice, preset, refineText, bgm, temperature, topP, topK, speed, maxRetries, aspectRatio]);

    useEffect(() => {
        import('../api').then(mod => mod.getBgms().then(setBgmList));
    }, []);

    useEffect(() => {
        if (initialOptions) {
            if (initialOptions.prompt) setPrompt(initialOptions.prompt);
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

    const CHATTTS_PRESETS: Record<string, Partial<DynamicVideoOptions>> = {
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

    const handleAddImage = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files).map(file => ({ file, description: '' }));
            setUserImages([...userImages, ...newFiles]);
        }
    };

    const handleRemoveImage = (index: number) => {
        setUserImages(userImages.filter((_, i) => i !== index));
    };

    const handleDescriptionChange = (index: number, desc: string) => {
        const updated = [...userImages];
        updated[index].description = desc;
        setUserImages(updated);
    };

    const handleSubmit = () => {
        if (!prompt.trim()) return;
        
        // Ensure all descriptions are filled
        const missingDesc = userImages.some(img => !img.description.trim());
        if (missingDesc) {
            alert('请为所有图片填写描述 (Descriptions are mandatory)');
            return;
        }

        onGenerate({
            prompt,
            ttsEngine,
            voice,
            temperature,
            top_p: topP,
            top_k: topK,
            speed,
            refine_text: refineText,
            bgm: bgm !== 'none' ? bgm : undefined,
            aspectRatio,
            files: userImages.map(img => img.file),
            imageDescriptions: JSON.stringify(userImages.map(img => img.description)),
            maxRetries
        });
    };

    return (
        <div className="dynamic-video-form">
            <div style={{ marginBottom: '1.5rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h4 className="section-title" style={{ marginBottom: '1rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Sparkles size={18} /> LLM 提示词 (Prompt)
                </h4>
                <div>
                    <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>描述你想要的视频布局、风格、动画效果等</label>
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="例如：一个深色的背景，居中的大字标题，背景有一些漂浮的粒子特效..."
                        style={{
                            width: '100%',
                            minHeight: '100px',
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
            </div>

            <div style={{ marginBottom: '1.5rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h4 className="section-title" style={{ marginBottom: '1rem', fontSize: '1rem' }}>📐 视频比例 (Aspect Ratio)</h4>
                <div style={{ display: 'flex', gap: '2rem' }}>
                    <label className="radio-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <input
                            type="radio"
                            name="aspectRatio"
                            value="9:16"
                            checked={aspectRatio === '9:16'}
                            onChange={() => setAspectRatio('9:16')}
                            style={{ accentColor: 'var(--accent-primary)' }}
                        />
                        <span>9:16 (竖屏 / Portrait)</span>
                    </label>
                    <label className="radio-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <input
                            type="radio"
                            name="aspectRatio"
                            value="16:9"
                            checked={aspectRatio === '16:9'}
                            onChange={() => setAspectRatio('16:9')}
                            style={{ accentColor: 'var(--accent-primary)' }}
                        />
                        <span>16:9 (横屏 / Landscape)</span>
                    </label>
                </div>
            </div>

            <div style={{ marginBottom: '1.5rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h4 className="section-title" style={{ marginBottom: '1rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Image size={18} /> 🖼️ 素材图片 (Source Images)
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                        {userImages.map((img, idx) => (
                            <div key={idx} style={{ 
                                position: 'relative', 
                                background: 'rgba(0,0,0,0.4)', 
                                borderRadius: '12px', 
                                padding: '0.75rem',
                                border: '1px solid rgba(255,255,255,0.1)'
                            }}>
                                <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', borderRadius: '8px', overflow: 'hidden', marginBottom: '0.75rem' }}>
                                    <img 
                                        src={URL.createObjectURL(img.file)} 
                                        alt={`upload-${idx}`} 
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                    <button 
                                        onClick={() => handleRemoveImage(idx)}
                                        style={{ 
                                            position: 'absolute', top: '5px', right: '5px', 
                                            background: 'rgba(239, 68, 68, 0.8)', color: 'white', 
                                            border: 'none', borderRadius: '50%', padding: '5px',
                                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>图片描述 (必填):</label>
                                    <textarea
                                        value={img.description}
                                        onChange={(e) => handleDescriptionChange(idx, e.target.value)}
                                        placeholder="例如：这是产品的正面特写，展示了精致的金属拉丝纹理"
                                        style={{ 
                                            width: '100%', minHeight: '60px', padding: '0.5rem', 
                                            borderRadius: '6px', background: 'rgba(0,0,0,0.3)', 
                                            color: 'white', border: '1px solid rgba(255,255,255,0.1)',
                                            fontSize: '0.85rem', outline: 'none', resize: 'none'
                                        }}
                                    />
                                </div>
                            </div>
                        ))}
                        <label style={{ 
                            border: '2px dashed rgba(255,255,255,0.1)', 
                            borderRadius: '12px', 
                            display: 'flex', flexDirection: 'column', 
                            alignItems: 'center', justifyContent: 'center', 
                            cursor: 'pointer', gap: '0.5rem',
                            minHeight: '150px',
                            transition: 'all 0.2s ease'
                        }} className="upload-box-hover">
                            <input type="file" multiple accept="image/*" onChange={handleAddImage} style={{ display: 'none' }} />
                            <Plus size={32} color="var(--text-secondary)" />
                            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>添加图片</span>
                        </label>
                    </div>
                    {userImages.length > 0 && (
                        <p style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', marginTop: '0.5rem' }}>
                            💡 提示：详细的描述能帮助 LLM 更好地决定图片的展示时机。
                        </p>
                    )}
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
                        <input
                            type="text"
                            placeholder={ttsEngine === 'kokoro' ? "e.g. af_heart, jm_kama..." : (ttsEngine === 'chattts' ? "Seed number or empty" : (ttsEngine === 'omnivoice' ? "e.g. female, british accent" : "e.g. zh-CN-XiaoxiaoNeural..."))}
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
                        </div>
                        <div className="form-group" style={{ marginTop: '1rem' }}>
                            <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>最大重试次数 (LLM 纠错)</label>
                            <input
                                type="number"
                                min="0"
                                max="5"
                                value={maxRetries}
                                onChange={(e) => setMaxRetries(parseInt(e.target.value))}
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
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ marginTop: '2.5rem', textAlign: 'center' }}>
                <button
                    className="btn-primary"
                    onClick={handleSubmit}
                    disabled={disabled || !prompt.trim()}
                    style={{ width: '100%', marginTop: '1.5rem' }}
                >
                    {submitLabel}
                    <Play size={18} fill="currentColor" />
                </button>
            </div>
        </div >
    );
};
