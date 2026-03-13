import React, { useState } from 'react';
import { Sparkles, Wand2, ImagePlus, X, Loader2, MessageSquare, Mic, Play } from 'lucide-react';
import { generateAgentVideo, generateAIScript } from '../api';
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
    const [temperature, setTemperature] = useState(0.3);
    const [topP, setTopP] = useState(0.7);
    const [topK, setTopK] = useState(20);
    const [speed, setSpeed] = useState(1.0);
    const [refineText, setRefineText] = useState(true);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files).map(file => ({
                id: Math.random().toString(36).substr(2, 9),
                file,
                description: ''
            }));
            setImages(prev => [...prev, ...newFiles]);
        }
    };

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
                refine_text: refineText
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
                            <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>添加图片</span>
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
                            {['edge', 'chattts', 'kokoro'].map(engine => (
                                <label key={engine} style={{
                                    cursor: 'pointer',
                                    padding: '0.5rem 1rem',
                                    borderRadius: '8px',
                                    background: ttsEngine === engine ? 'var(--accent-primary)' : 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    fontSize: '0.85rem'
                                }}>
                                    <input type="radio" name="agent_engine" value={engine} checked={ttsEngine === engine} onChange={() => setTtsEngine(engine)} style={{ display: 'none' }} />
                                    {engine.toUpperCase()}
                                </label>
                            ))}
                        </div>
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
                                color: 'white'
                            }}
                        />
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
