import React, { useState, useEffect } from 'react';
import { Settings, X } from 'lucide-react';

export interface LLMSettings {
    apiKey: string;
    baseUrl: string;
    model: string;
}

interface SettingsPanelProps {
    onSettingsChange: (settings: LLMSettings) => void;
    isOpen: boolean;
    onClose: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ onSettingsChange, isOpen, onClose }) => {
    const [settings, setSettings] = useState<LLMSettings>({
        apiKey: '',
        baseUrl: '',
        model: ''
    });

    useEffect(() => {
        // Load from local storage
        const storedApiKey = localStorage.getItem('llmApiKey') || '';
        const storedBaseUrl = localStorage.getItem('llmBaseUrl') || '';
        const storedModel = localStorage.getItem('llmModel') || '';

        const initialSettings = { apiKey: storedApiKey, baseUrl: storedBaseUrl, model: storedModel };
        setSettings(initialSettings);
        onSettingsChange(initialSettings);
    }, []); // Run once on mount

    const handleSave = (key: keyof LLMSettings, value: string) => {
        const newSettings = { ...settings, [key]: value };
        setSettings(newSettings);

        // Save to local storage
        localStorage.setItem('llmApiKey', newSettings.apiKey);
        localStorage.setItem('llmBaseUrl', newSettings.baseUrl);
        localStorage.setItem('llmModel', newSettings.model);

        onSettingsChange(newSettings);
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content settings-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Settings size={20} className="accent-icon" />
                        <h3 style={{ margin: 0 }}>LLM Configuration</h3>
                    </div>
                    <button className="close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="modal-body settings-body">
                    <div className="prompt-group" style={{ marginTop: 0 }}>
                        <label>API Key</label>
                        <input
                            type="password"
                            className="prompt-textarea"
                            style={{ minHeight: '40px', padding: '0.75rem' }}
                            placeholder="sk-..."
                            value={settings.apiKey}
                            onChange={(e) => handleSave('apiKey', e.target.value)}
                        />
                    </div>
                    <div className="prompt-group">
                        <label>Base URL</label>
                        <input
                            type="text"
                            className="prompt-textarea"
                            style={{ minHeight: '40px', padding: '0.75rem' }}
                            placeholder="https://api.openai.com/v1"
                            value={settings.baseUrl}
                            onChange={(e) => handleSave('baseUrl', e.target.value)}
                        />
                    </div>
                    <div className="prompt-group">
                        <label>Model Name</label>
                        <input
                            type="text"
                            className="prompt-textarea"
                            style={{ minHeight: '40px', padding: '0.75rem' }}
                            placeholder="gpt-3.5-turbo / qwen-v1"
                            value={settings.model}
                            onChange={(e) => handleSave('model', e.target.value)}
                        />
                    </div>
                    <div style={{
                        marginTop: '1.5rem',
                        padding: '1rem',
                        background: 'rgba(79, 70, 229, 0.1)',
                        borderRadius: '8px',
                        fontSize: '0.85rem',
                        color: 'var(--text-secondary)',
                        lineHeight: '1.5',
                        border: '1px solid rgba(79, 70, 229, 0.2)'
                    }}>
                        提示: 留空将使用系统默认配置。设置将保存在浏览器的本地存储中，不会上传到非业务服务器之外的任何地方。
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="btn-primary" onClick={onClose} style={{ width: '100%' }}>
                        确认并关闭
                    </button>
                </div>
            </div>
        </div>
    );
};
