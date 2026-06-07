import React, { useState, useEffect } from 'react';
import { Sparkles, Wand2, ImagePlus, X, Loader2, MessageSquare, Mic, Play } from 'lucide-react';
import { generateAgentVideo, generateAIScript, getAssetUrl } from '../api';
import type { LLMSettings } from '../api';

interface AgentVideoFormProps {
    llmSettings: LLMSettings;
    onTaskCreated: (taskId: string) => void;
    disabled?: boolean;
}

interface ImageItem {
    id: string;
    file: File;
    description: string;
}

export const AgentVideoForm: React.FC<AgentVideoFormProps> = ({ llmSettings, onTaskCreated, disabled }) => {
    const [prompt, setPrompt] = useState('');
    const [text, setText] = useState('');
    const [images, setImages] = useState<ImageItem[]>([]);
    const [isGeneratingScript, setIsGeneratingScript] = useState(false);
    const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // TTS Settings
    const [ttsEngine, setTtsEngine] = useState('edge');
    const [voice, setVoice] = useState('');
    const [mlxModel, setMlxModel] = useState('mlx-community/Qwen3-TTS-12Hz-0.6B-CustomVoice-bf16');
    const [mlxVoice, setMlxVoice] = useState('Vivian');
    // OmniVoice: 'instruct' = style, 'clone' = voice cloning
    const [omnivoiceMode, setOmnivoiceMode] = useState<'instruct' | 'clone'>('instruct');
    const [omnivoiceCloneSource, setOmnivoiceCloneSource] = useState<'preset' | 'upload'>('preset');
    const [temperature, setTemperature] = useState(0.3);
    const [topP, setTopP] = useState(0.7);
    const [topK, setTopK] = useState(20);
    const [speed, setSpeed] = useState(1.0);
    const [refineText, setRefineText] = useState(true);
    const [bgm, setBgm] = useState<string>('');
    const [bgmList, setBgmList] = useState<string[]>([]);

    useEffect(() => {
        if (ttsEngine === 'mlx') {
            setVoice(`${mlxModel}:${mlxVoice}`);
        }
    }, [ttsEngine, mlxModel, mlxVoice]);

    React.useEffect(() => {
        import('../api').then(mod => mod.getBgms().then(setBgmList));
    }, []);

    const addImages = (files: File[]) => {
        const newFiles = files.map(file => ({
            id: Math.random().toString(36).substr(2, 9),
            file,
            description: ''
        }));
        setImages(prev => [...prev, ...newFiles]);
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            addImages(Array.from(e.target.files));
        }
    };

    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            if (disabled) return;
            const files = e.clipboardData?.files;
            if (files && files.length > 0) {
                const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
                if (imageFiles.length > 0) {
                    addImages(imageFiles);
                    e.preventDefault();
                }
            }
        };

        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [disabled]);

    const removeImage = (id: string) => {
        setImages(prev => prev.filter(img => img.id !== id));
    };

    const updateImageDesc = (id: string, desc: string) => {
        setImages(prev => prev.map(img => img.id === id ? { ...img, description: desc } : img));
    };

    const handleGenerateScript = async () => {
        if (!prompt.trim()) return;

        if (text.trim() && !window.confirm('生成新文案将会覆盖现有的文案内容，是否继续？')) {
            return;
        }

        setIsGeneratingScript(true);
        setError(null);
        try {
            // Using a temporary task ID or similar if required by API, 
            // but for script generation we can use a placeholder or the backend handles it.
            // Actually, generateAIScript in api.ts requires a taskId. 
            // For Agent Mode, we might need a dedicated script generation that doesn't 
            // depend on a task context yet, or we create the task first.
            // For now, I'll pass an empty string and the backend will handle it as 'new task' 
            // or I'll use a specific endpoint. 
            // Let's assume we can generate script based on descriptions and prompt.

            // We'll update generateAIScript or use the agent_video endpoint's partial functionality.
            // Wait, the agent_video endpoint already generates text if text is empty.
            // But user wants to see it and edit it first.

            const descStr = images.map(img => img.description).join(', ');
            const fullPrompt = `图片集包含: ${descStr}. \n用户指令: ${prompt}`;

            // We'll use a "dummy" task ID for now or just the prompt logic.
            const script = await generateAIScript('agent_init', fullPrompt, llmSettings);
            setText(script);
        } catch (err: any) {
            setError(err.message || '脚本生成失败');
        } finally {
            setIsGeneratingScript(false);
        }
    };

    const handleSubmit = async () => {
        if (!text.trim()) return;
        setIsGeneratingVideo(true);
        setError(null);
        try {
            const options = {
                text,
                ttsEngine,
                voice,
                temperature,
                top_p: topP,
                top_k: topK,
                speed,
                refine_text: refineText,
                bgm: bgm || undefined
            };
            const imageDescriptions = images.map(img => ({
                id: img.file.name,
                desc: img.description
            }));
            const result = await generateAgentVideo(options, images.map(img => img.file), imageDescriptions, prompt, llmSettings);
            onTaskCreated(result.taskId);
        } catch (err: any) {
            setError(err.message || '视频生成失败');
        } finally {
            setIsGeneratingVideo(false);
        }
    };

    return (
        <div className="agent-video-form" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Step 1: Prompt & Images */}
            <section style={{
                background: 'rgba(255,255,255,0.03)',
                padding: '1.5rem',
                borderRadius: '16px',
                border: '1px solid rgba(255,255,255,0.1)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    <div style={{ background: 'var(--accent-primary)', padding: '8px', borderRadius: '10px' }}>
                        <Sparkles size={20} color="white" />
                    </div>
                    <h3 style={{ margin: 0 }}>Step 1: AI 文案策划</h3>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', opacity: 0.8 }}>
                        你想做一个什么样的视频？ (AI 提示词)
                    </label>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <input
                            type="text"
                            className="prompt-textarea"
                            placeholder="描述视频主题，例如：介绍一款新款手机，强调它的拍照功能"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            style={{ flex: 1, minHeight: 'unset', height: '44px', padding: '0 1rem' }}
                        />
                        <button
                            className="btn-primary"
                            onClick={handleGenerateScript}
                            disabled={isGeneratingScript || !prompt.trim() || disabled}
                            style={{ padding: '0 1.25rem', height: '44px', display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }}
                        >
                            {isGeneratingScript ? <Loader2 className="spinner" size={18} /> : <Wand2 size={18} />}
                            生成文案
                        </button>
                    </div>
                </div>

                <div>
                    <label style={{ display: 'block', marginBottom: '1rem', fontSize: '0.9rem', opacity: 0.8 }}>
                        上传插图并描述 (可选)
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                        {images.map(img => (
                            <div key={img.id} style={{
                                background: 'rgba(0,0,0,0.2)',
                                borderRadius: '12px',
                                padding: '1rem',
                                border: '1px solid rgba(255,255,255,0.05)',
                                position: 'relative'
                            }}>
                                <button
                                    onClick={() => removeImage(img.id)}
                                    style={{ position: 'absolute', right: '0.5rem', top: '0.5rem', background: 'rgba(255,0,0,0.2)', border: 'none', borderRadius: '50%', color: 'white', padding: '4px', cursor: 'pointer' }}
                                >
                                    <X size={14} />
                                </button>
                                <div style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '0.5rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {img.file.name}
                                </div>
                                <textarea
                                    placeholder="描述图片内容..."
                                    value={img.description}
                                    onChange={(e) => updateImageDesc(img.id, e.target.value)}
                                    style={{
                                        width: '100%',
                                        height: '60px',
                                        background: 'transparent',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '6px',
                                        color: 'white',
                                        fontSize: '0.85rem',
                                        padding: '0.5rem',
                                        resize: 'none'
                                    }}
                                />
                            </div>
                        ))}
                        <label style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            border: '2px dashed rgba(255,255,255,0.1)',
                            borderRadius: '12px',
                            minHeight: '120px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            background: 'rgba(255,255,255,0.02)'
                        }}
                            onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent-primary)'}
                            onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
                        >
                            <input type="file" multiple accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                            <ImagePlus size={24} style={{ opacity: 0.5 }} />
                            <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>添加/粘贴图片</span>
                        </label>
                    </div>
                </div>
            </section>

            {/* Step 2: Content & TTS */}
            <section style={{
                background: 'rgba(255,255,255,0.03)',
                padding: '1.5rem',
                borderRadius: '16px',
                border: '1px solid rgba(255,255,255,0.1)',
                opacity: disabled ? 0.6 : 1,
                transition: 'all 0.3s'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    <div style={{ background: '#10b981', padding: '8px', borderRadius: '10px' }}>
                        <MessageSquare size={20} color="white" />
                    </div>
                    <h3 style={{ margin: 0 }}>Step 2: 内容确认与语音配置</h3>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', opacity: 0.8 }}>
                        口播文案 (可手动修改)
                    </label>
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        readOnly={isGeneratingScript}
                        placeholder={isGeneratingScript ? "正在为您构思精彩文案..." : "在此输入或生成口播文案..."}
                        style={{
                            width: '100%',
                            minHeight: '150px',
                            padding: '1rem',
                            borderRadius: '12px',
                            border: '1px solid rgba(255,255,255,0.1)',
                            backgroundColor: isGeneratingScript ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.3)',
                            color: 'white',
                            fontSize: '1rem',
                            lineHeight: '1.6',
                            outline: 'none',
                            transition: 'all 0.3s'
                        }}
                    />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                    <div>
                        <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', opacity: 0.8 }}>
                            <Mic size={18} /> 语音引擎
                        </h4>
                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                            {['edge', 'chattts', 'kokoro', 'omnivoice', 'voxcpm', 'mlx'].map(engine => (
                                <label key={engine} style={{
                                    cursor: 'pointer',
                                    padding: '0.5rem 1rem',
                                    borderRadius: '8px',
                                    background: ttsEngine === engine ? 'var(--accent-primary)' : 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    fontSize: '0.85rem'
                                }}>
                                    <input type="radio" name="agent_engine" value={engine} checked={ttsEngine === engine} onChange={() => {
                                        setTtsEngine(engine);
                                        if (engine === 'edge') setVoice('zh-CN-XiaoxiaoNeural');
                                        else if (engine === 'kokoro') setVoice('af_heart');
                                        else if (engine === 'omnivoice') setVoice('女');
                                        else if (engine === 'voxcpm') setVoice('A young female, gentle and sweet voice');
                                        else if (engine === 'mlx') setVoice('mlx-community/Qwen3-TTS-12Hz-0.6B-CustomVoice-bf16:Vivian');
                                        else setVoice('');
                                    }} style={{ display: 'none' }} />
                                    {engine.toUpperCase()}
                                </label>
                            ))}
                        </div>
                        {ttsEngine === "edge" ? (
                            <select
                                value={voice}
                                onChange={(e) => setVoice(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '0.8rem',
                                    borderRadius: '8px',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    background: 'rgba(0,0,0,0.2)',
                                    color: 'white',
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
                                style={{
                                    width: '100%',
                                    padding: '0.8rem',
                                    borderRadius: '8px',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    background: 'rgba(0,0,0,0.2)',
                                    color: 'white',
                                    outline: 'none'
                                }}
                            >
                                <option value="af_heart">af_heart (默认)</option>
                                <option value="af_alloy">af_alloy</option>
                                <option value="am_adam">am_adam</option>
                            </select>
                        ) : ttsEngine === "mlx" ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', width: '100%' }}>
                                <div>
                                    <span style={{ fontSize: '0.8rem', opacity: 0.6, display: 'block', marginBottom: '0.4rem' }}>模型 (Model)</span>
                                    <select
                                        value={mlxModel}
                                        onChange={(e) => {
                                            const model = e.target.value;
                                            setMlxModel(model);
                                            if (model.includes('Kokoro')) {
                                                setMlxVoice('af_heart');
                                            } else {
                                                setMlxVoice('Vivian');
                                            }
                                        }}
                                        style={{
                                            width: '100%',
                                            padding: '0.8rem',
                                            borderRadius: '8px',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            background: 'rgba(0,0,0,0.2)',
                                            color: 'white',
                                            outline: 'none'
                                        }}
                                    >
                                        <option value="mlx-community/Qwen3-TTS-12Hz-0.6B-CustomVoice-bf16">Qwen3-TTS 0.6B (默认/快速)</option>
                                        <option value="mlx-community/Qwen3-TTS-12Hz-1.7B-CustomVoice-bf16">Qwen3-TTS 1.7B (高音质)</option>
                                        <option value="mlx-community/Kokoro-82M-bf16">Kokoro-82M (MLX版)</option>
                                    </select>
                                </div>
                                <div>
                                    <span style={{ fontSize: '0.8rem', opacity: 0.6, display: 'block', marginBottom: '0.4rem' }}>音色 (Voice)</span>
                                    {mlxModel.includes('Kokoro') ? (
                                        <select
                                            value={mlxVoice}
                                            onChange={(e) => setMlxVoice(e.target.value)}
                                            style={{
                                                width: '100%',
                                                padding: '0.8rem',
                                                borderRadius: '8px',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                background: 'rgba(0,0,0,0.2)',
                                                color: 'white',
                                                outline: 'none'
                                            }}
                                        >
                                            <option value="af_heart">af_heart (默认女声)</option>
                                            <option value="af_alloy">af_alloy (年轻女声)</option>
                                            <option value="am_adam">am_adam (英文男声)</option>
                                        </select>
                                    ) : (
                                        <select
                                            value={mlxVoice}
                                            onChange={(e) => setMlxVoice(e.target.value)}
                                            style={{
                                                width: '100%',
                                                padding: '0.8rem',
                                                borderRadius: '8px',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                background: 'rgba(0,0,0,0.2)',
                                                color: 'white',
                                                outline: 'none'
                                            }}
                                        >
                                            <option value="Vivian">Vivian (默认女声)</option>
                                            <option value="Serena">Serena (年轻女声)</option>
                                            <option value="Uncle_Fu">Uncle_Fu (成熟男声)</option>
                                            <option value="Ryan">Ryan (英文男声)</option>
                                            <option value="Aiden">Aiden (英文男声)</option>
                                            <option value="Dylan">Dylan (北京方言男声)</option>
                                            <option value="Eric">Eric (四川方言男声)</option>
                                        </select>
                                    )}
                                </div>
                            </div>
                        ) : ttsEngine === "omnivoice" ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', width: '100%' }}>
                                {/* Mode selector */}
                                <div style={{ display: 'flex', gap: '1.2rem', marginBottom: '0.2rem' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                                        <input
                                            type="radio"
                                            name="omnivoiceModeAgent"
                                            checked={omnivoiceMode !== 'clone'}
                                            onChange={() => { setOmnivoiceMode('instruct'); setVoice('女'); }}
                                            style={{ accentColor: 'var(--accent-primary)' }}
                                        />
                                        <span>风格指令</span>
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                                        <input
                                            type="radio"
                                            name="omnivoiceModeAgent"
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
                                        style={{
                                            width: '100%',
                                            padding: '0.8rem',
                                            borderRadius: '8px',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            background: 'rgba(0,0,0,0.2)',
                                            color: 'white',
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
                                                    name="omnivoiceCloneSourceAgent"
                                                    checked={omnivoiceCloneSource === 'preset'}
                                                    onChange={() => { setOmnivoiceCloneSource('preset'); setVoice('biaoge'); }}
                                                    style={{ accentColor: 'var(--accent-primary)' }}
                                                />
                                                <span>使用预设音频</span>
                                            </label>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                                                <input
                                                    type="radio"
                                                    name="omnivoiceCloneSourceAgent"
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
                                                style={{
                                                    width: '100%',
                                                    padding: '0.8rem',
                                                    borderRadius: '8px',
                                                    border: '1px solid rgba(255,255,255,0.1)',
                                                    background: 'rgba(0,0,0,0.2)',
                                                    color: 'white',
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
                                                        border: '1px solid rgba(255,255,255,0.1)',
                                                        background: 'rgba(0,0,0,0.1)',
                                                        color: '#ccc',
                                                        outline: 'none',
                                                        cursor: 'default'
                                                    }}
                                                />
                                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => document.getElementById('omnivoice-file-upload-agent')?.click()}
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
                                                        id="omnivoice-file-upload-agent"
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
                                                     name="voxcpmModeAgent"
                                                     checked={!voice || voice === 'biaoge' || voice === 'boniu' || voice === 'liuxi'}
                                                     onChange={() => setVoice('biaoge')}
                                                     style={{ accentColor: 'var(--accent-primary)' }}
                                                 />
                                                 <span>使用预设音色</span>
                                             </label>
                                             <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                                                 <input
                                                     type="radio"
                                                     name="voxcpmModeAgent"
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
                                                     border: '1px solid rgba(255,255,255,0.1)',
                                                     background: 'rgba(0,0,0,0.2)',
                                                     color: 'white',
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
                                                      border: '1px solid rgba(255,255,255,0.1)',
                                                      background: 'rgba(0,0,0,0.2)',
                                                      color: 'white',
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
                                         placeholder="Voice Name / Seed"
                                         value={voice}
                                         onChange={(e) => setVoice(e.target.value)}
                                         style={{
                                             width: '100%',
                                             padding: '0.8rem',
                                             borderRadius: '8px',
                                             border: '1px solid rgba(255,255,255,0.1)',
                                             background: 'rgba(0,0,0,0.2)',
                                             color: 'white',
                                             outline: 'none'
                                         }}
                                     />
                                 )}
                             </div>
                         )}
                    </div>
                    
                    <div style={{ gridColumn: '1 / -1', marginBottom: '1rem' }}>
                        <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', opacity: 0.8 }}>
                            🎵 视频背景音乐 (BGM)
                        </h4>
                        <select
                            value={bgm}
                            onChange={(e) => setBgm(e.target.value)}
                            disabled={disabled}
                            style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white', outline: 'none' }}
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

                    <div>
                        <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', opacity: 0.8 }}>
                            高级参数
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.85rem' }}>速度: {speed}x</span>
                                <input type="range" min="0.5" max="2.0" step="0.1" value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value))} style={{ accentColor: 'var(--accent-primary)', width: '100px' }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.85rem' }}>情感 (Temp): {temperature}</span>
                                <input type="range" min="0.1" max="1.0" step="0.1" value={temperature} onChange={(e) => setTemperature(parseFloat(e.target.value))} style={{ accentColor: 'var(--accent-primary)', width: '100px' }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.85rem' }}>多样性 (Top P): {topP}</span>
                                <input type="range" min="0.1" max="1.0" step="0.1" value={topP} onChange={(e) => setTopP(parseFloat(e.target.value))} style={{ accentColor: 'var(--accent-primary)', width: '100px' }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.85rem' }}>随机性 (Top K): {topK}</span>
                                <input type="range" min="1" max="50" step="1" value={topK} onChange={(e) => setTopK(parseInt(e.target.value))} style={{ accentColor: 'var(--accent-primary)', width: '100px' }} />
                            </div>
                            <div style={{ marginTop: '0.5rem' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                                    <input type="checkbox" checked={refineText} onChange={(e) => setRefineText(e.target.checked)} style={{ accentColor: 'var(--accent-primary)' }} />
                                    <span>文本优化 (Refine Text)</span>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                <button
                    className="btn-primary"
                    onClick={handleSubmit}
                    disabled={isGeneratingVideo || !text.trim() || disabled}
                    style={{ width: '100%', marginTop: '2rem', height: '50px', fontSize: '1.1rem', gap: '0.75rem' }}
                >
                    {isGeneratingVideo ? <Loader2 className="spinner" size={20} /> : <Play size={20} fill="currentColor" />}
                    立即生成 Agent 视频
                </button>
                {error && <p style={{ color: '#ef4444', textAlign: 'center', marginTop: '1rem' }}>{error}</p>}
            </section>
        </div>
    );
};
