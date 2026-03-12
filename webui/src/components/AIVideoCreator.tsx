import React, { useState } from 'react';
import { Sparkles, Loader2, Wand2, MessageSquareQuote } from 'lucide-react';
import { generateAIScript, generateTTSVideo } from '../api';
import type { LLMSettings } from './SettingsPanel';
import { TTSVideoForm } from './TTSVideoForm';

interface AIVideoCreatorProps {
    taskId: string;
    contextText: string;
    llmSettings: LLMSettings;
    onTaskCreated: (newTaskId: string) => void;
}

export const AIVideoCreator: React.FC<AIVideoCreatorProps> = ({
    taskId,
    contextText,
    llmSettings,
    onTaskCreated
}) => {
    const [prompt, setPrompt] = useState<string>('');
    const [generatedScript, setGeneratedScript] = useState<string>('');
    const [isGeneratingScript, setIsGeneratingScript] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleGenerateScript = async () => {
        if (!prompt.trim()) return;
        setIsGeneratingScript(true);
        setError(null);
        try {
            const script = await generateAIScript(taskId, prompt, llmSettings);
            setGeneratedScript(script);
        } catch (err: any) {
            setError(err.message || 'AI 生成脚本失败');
        } finally {
            setIsGeneratingScript(false);
        }
    };

    const handleTTSGenerate = async (options: { text: string; ttsEngine: string; voice: string }) => {
        try {
            const newTaskId = await generateTTSVideo(options);
            onTaskCreated(newTaskId);
        } catch (err: any) {
            setError(err.message || '生成视频失败');
        }
    };

    return (
        <div className="ai-video-creator" style={{
            marginTop: '2rem',
            padding: '1.5rem',
            background: 'rgba(255, 255, 255, 0.02)',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <div style={{
                    background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                    padding: '8px',
                    borderRadius: '10px'
                }}>
                    <Sparkles size={20} color="white" />
                </div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>AI 视频再创作</h2>
            </div>

            <div style={{
                background: 'rgba(255,255,255,0.03)',
                padding: '0.8rem 1.2rem',
                borderRadius: '8px',
                marginBottom: '1.5rem',
                borderLeft: '4px solid #6366f1',
                fontSize: '0.9rem',
                color: 'var(--text-secondary)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
                    <MessageSquareQuote size={14} />
                    <strong>上下文 (原始转录):</strong>
                </div>
                <div style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical'
                }}>
                    {contextText || "暂无转录内容"}
                </div>
            </div>

            <div className="prompt-section" style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', opacity: 0.8 }}>
                    AI 改写指令 (Prompt)
                </label>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <input
                        type="text"
                        className="prompt-textarea"
                        placeholder="例如: 把这段内容改写成一段幽默的小短文，增加一些 [laugh] 装饰"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleGenerateScript()}
                        style={{ flex: 1, minHeight: 'unset', height: '42px', padding: '0 1rem' }}
                    />
                    <button
                        className="btn-primary"
                        onClick={handleGenerateScript}
                        disabled={isGeneratingScript || !prompt.trim() || !contextText}
                        style={{ padding: '0 1.25rem', height: '42px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        {isGeneratingScript ? <Loader2 className="spinner" size={18} /> : <Wand2 size={18} />}
                        生成脚本
                    </button>
                </div>
                {error && <p style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '0.5rem' }}>{error}</p>}
            </div>

            {generatedScript && (
                <div className="script-editor-section" style={{
                    borderTop: '1px solid rgba(255,255,255,0.05)',
                    paddingTop: '1.5rem',
                    animation: 'fadeIn 0.5s ease-out'
                }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', opacity: 0.8 }}>
                        生成的脚本内容 (可手动修改)
                    </label>
                    <TTSVideoForm
                        initialText={generatedScript}
                        onGenerate={handleTTSGenerate}
                        submitLabel="生成新视频"
                    />
                </div>
            )}
        </div>
    );
};
