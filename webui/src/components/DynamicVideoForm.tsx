import React, { useState, useEffect } from 'react';
import { Type, Play, Sparkles, Image, Plus, Trash2 } from 'lucide-react';
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

    const [mode, setMode] = useState<'prompt' | 'json'>(() => {
        return (localStorage.getItem('dynamic-video-mode') as 'prompt' | 'json') || 'prompt';
    });

    const [jsonPrompt, setJsonPrompt] = useState(() => {
        const cached = localStorage.getItem('dynamic-video-jsonPrompt');
        return cached || JSON.stringify({
            author: '@your_handle',
            topic: 'AI工具速递',
            title: '语音AI终于听懂你情绪了',
            titleHighlight: '听懂',
            bodyText: '副语言识别 · 百万人格组合 · 中英双语',
            progressPercent: 45,
            outroTagline: 'AI · 工具 · 变现',
            fontMode: 'default',
            captions: '这里是口播文案，TTS 将会自动把这段文字转化为语音，并合成到 Remotion 视频中。'
        }, null, 2);
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
    const [userAssets, setUserAssets] = useState<{ file: File; description: string; type: 'image' | 'video'; previewUrl: string }[]>([]);

    useEffect(() => {
        localStorage.setItem('dynamic-video-prompt', prompt);
        localStorage.setItem('dynamic-video-jsonPrompt', jsonPrompt);
        localStorage.setItem('dynamic-video-mode', mode);
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
    }, [prompt, jsonPrompt, mode, ttsEngine, voice, preset, refineText, bgm, temperature, topP, topK, speed, maxRetries, aspectRatio]);

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

    const addAssets = (files: File[]) => {
        const newFiles = files.map(file => ({ 
            file, 
            description: '',
            type: file.type.startsWith('video/') ? 'video' as const : 'image' as const,
            previewUrl: URL.createObjectURL(file)
        }));
        setUserAssets(prev => [...prev, ...newFiles]);
    };

    const handleAddAsset = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            addAssets(Array.from(e.target.files));
        }
    };

    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            if (disabled) return;
            const files = e.clipboardData?.files;
            if (files && files.length > 0) {
                const assetFiles = Array.from(files).filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
                if (assetFiles.length > 0) {
                    addAssets(assetFiles);
                    e.preventDefault();
                }
            }
        };

        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [disabled]);

    const handleRemoveAsset = (index: number) => {
        const asset = userAssets[index];
        if (asset.previewUrl) URL.revokeObjectURL(asset.previewUrl);
        setUserAssets(userAssets.filter((_, i) => i !== index));
    };

    const handleDescriptionChange = (index: number, desc: string) => {
        const updated = [...userAssets];
        updated[index] = { ...updated[index], description: desc };
        setUserAssets(updated);
    };

    // Cleanup URLs on unmount
    useEffect(() => {
        return () => {
            userAssets.forEach(asset => {
                if (asset.previewUrl) URL.revokeObjectURL(asset.previewUrl);
            });
        };
    }, []);

    const handleSubmit = () => {
        let finalPrompt = prompt;
        if (mode === 'json') {
            try {
                JSON.parse(jsonPrompt);
                finalPrompt = jsonPrompt;
            } catch (e: any) {
                alert('JSON 格式错误，请检查！\n' + e.message);
                return;
            }
        } else {
            if (!prompt.trim()) return;
        }
        
        // Ensure all descriptions are filled
        const missingDesc = userAssets.some(asset => !asset.description.trim());
        if (missingDesc) {
            alert('请为所有素材填写描述 (Descriptions are mandatory)');
            return;
        }

        onGenerate({
            prompt: finalPrompt,
            mode,
            ttsEngine,
            voice,
            temperature,
            top_p: topP,
            top_k: topK,
            speed,
            refine_text: refineText,
            bgm: bgm !== 'none' ? bgm : undefined,
            aspectRatio,
            files: userAssets.map(asset => asset.file),
            imageDescriptions: JSON.stringify(userAssets.map(asset => asset.description)),
            maxRetries
        });
    };

    return (
        <div className="dynamic-video-form">
            <div style={{ marginBottom: '1.5rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h4 className="section-title" style={{ marginBottom: '1rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Sparkles size={18} /> 运行模式 (Workflow Mode)
                </h4>
                <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value as 'prompt' | 'json')}
                    style={{
                        width: '100%',
                        padding: '0.8rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        background: 'rgba(0,0,0,0.3)',
                        color: 'var(--text-primary)',
                        outline: 'none'
                    }}
                >
                    <option value="prompt">大模型提示词模式 (Prompt Mode)</option>
                    <option value="json">直接输入数据结构模式 (Direct JSON Mode)</option>
                </select>
            </div>

            {mode === 'prompt' ? (
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
            ) : (
                <div style={{ marginBottom: '1.5rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <h4 className="section-title" style={{ marginBottom: '1rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Type size={18} /> 数据结构 JSON (Template Props)
                    </h4>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                            直接指定合成参数，视频包含：标题卡、结尾卡、进度条和展开图文，将跳过大模型调用。
                            支持通过 <b>fontMode</b> 设置字体（可选值：'default' | 'pixel' (像素风) | 'techy' (科技风) | 'cute' (可爱风)）
                        </label>
                        <textarea
                            value={jsonPrompt}
                            onChange={(e) => setJsonPrompt(e.target.value)}
                            placeholder="请输入符合 TemplateProps 的 JSON 数据结构..."
                            style={{
                                width: '100%',
                                minHeight: '220px',
                                padding: '1rem',
                                borderRadius: '12px',
                                border: '1px solid var(--border-color)',
                                backgroundColor: 'rgba(0,0,0,0.3)',
                                color: 'var(--text-primary)',
                                fontSize: '0.95rem',
                                fontFamily: 'monospace',
                                lineHeight: '1.6',
                                outline: 'none',
                                resize: 'vertical'
                            }}
                        />
                    </div>
                </div>
            )}

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
                    <Image size={18} /> 🖼️ 素材 (Images & Videos)
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                        {userAssets.map((asset, idx) => (
                            <div key={idx} style={{ 
                                position: 'relative', 
                                background: 'rgba(0,0,0,0.4)', 
                                borderRadius: '12px', 
                                padding: '0.75rem',
                                border: '1px solid rgba(255,255,255,0.1)'
                            }}>
                                <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', borderRadius: '8px', overflow: 'hidden', marginBottom: '0.75rem' }}>
                                    {asset.type === 'video' ? (
                                        <video 
                                            src={asset.previewUrl} 
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            muted
                                            controls
                                            autoPlay={false}
                                        />
                                    ) : (
                                        <img 
                                            src={asset.previewUrl} 
                                            alt={`upload-${idx}`} 
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                    )}
                                    <button 
                                        onClick={() => handleRemoveAsset(idx)}
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
                                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>素材描述 (必填):</label>
                                    <textarea
                                        value={asset.description}
                                        onChange={(e) => handleDescriptionChange(idx, e.target.value)}
                                        placeholder="例如：这是产品的正面特写..."
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
                            <input type="file" multiple accept="image/*,video/*" onChange={handleAddAsset} style={{ display: 'none' }} />
                            <Plus size={32} color="var(--text-secondary)" />
                            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>添加/粘贴素材 (图片/视频)</span>
                        </label>
                    </div>
                    {userAssets.length > 0 && (
                        <p style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', marginTop: '0.5rem' }}>
                            💡 提示：详细的描述能帮助 LLM 更好地决定素材的展示时机。
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
                    disabled={disabled || (mode === 'prompt' ? !prompt.trim() : !jsonPrompt.trim())}
                    style={{ width: '100%', marginTop: '1.5rem' }}
                >
                    {submitLabel}
                    <Play size={18} fill="currentColor" />
                </button>
            </div>
        </div >
    );
};
