import React, { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';

export interface LLMSettings {
    apiKey: string;
    baseUrl: string;
    model: string;
}

interface SettingsPanelProps {
    onSettingsChange: (settings: LLMSettings) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ onSettingsChange }) => {
    const [isOpen, setIsOpen] = useState(false);
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

    return (
        <div className="settings-panel" style={{ marginBottom: '1.5rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div
                className="settings-header"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--text-primary)' }}
                onClick={() => setIsOpen(!isOpen)}
            >
                <Settings size={18} />
                <h3 style={{ margin: 0, fontSize: '1rem' }}>LLM Configuration (Optional)</h3>
                <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {isOpen ? '▲' : '▼'}
                </span>
            </div>

            {isOpen && (
                <div className="settings-body" style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="prompt-group" style={{ marginTop: 0 }}>
                        <label>API Key</label>
                        <input
                            type="password"
                            className="prompt-textarea"
                            style={{ minHeight: '40px', padding: '0.5rem' }}
                            placeholder="sk-..."
                            value={settings.apiKey}
                            onChange={(e) => handleSave('apiKey', e.target.value)}
                        />
                    </div>
                    <div className="prompt-group" style={{ marginTop: 0 }}>
                        <label>Base URL</label>
                        <input
                            type="text"
                            className="prompt-textarea"
                            style={{ minHeight: '40px', padding: '0.5rem' }}
                            placeholder="https://api.openai.com/v1"
                            value={settings.baseUrl}
                            onChange={(e) => handleSave('baseUrl', e.target.value)}
                        />
                    </div>
                    <div className="prompt-group" style={{ marginTop: 0 }}>
                        <label>Model Name</label>
                        <input
                            type="text"
                            className="prompt-textarea"
                            style={{ minHeight: '40px', padding: '0.5rem' }}
                            placeholder="gpt-3.5-turbo / qwen-v1"
                            value={settings.model}
                            onChange={(e) => handleSave('model', e.target.value)}
                        />
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                        * Leave blank to use system defaults. Settings are securely saved in your browser's localStorage.
                    </p>
                </div>
            )}
        </div>
    );
};
