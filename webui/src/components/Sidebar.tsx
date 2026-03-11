import React, { useState } from 'react';
import classNames from 'classnames';
import { Loader2, CheckCircle2, AlertCircle, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import type { TaskOverview } from '../api';

interface SidebarProps {
    tasks: TaskOverview[];
    taskId: string | null;
    onSelectTask: (id: string) => void;
    onNewVideo: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ tasks, taskId, onSelectTask, onNewVideo }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);

    return (
        <div className={classNames('sidebar', { 'collapsed': isCollapsed })}>
            <div className="sidebar-header" style={{ display: 'flex', flexDirection: 'column', alignItems: isCollapsed ? 'center' : 'stretch' }}>
                <div style={{ display: 'flex', justifyContent: isCollapsed ? 'center' : 'space-between', alignItems: 'center' }}>
                    {!isCollapsed && <h2>Task History</h2>}
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            padding: '0.25rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '4px'
                        }}
                        className="hover:bg-white/10"
                        title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                    >
                        {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
                    </button>
                </div>
                <button
                    className="btn-primary"
                    style={{
                        marginTop: '1rem',
                        width: '100%',
                        padding: isCollapsed ? '0.5rem 0' : '0.5rem',
                        fontSize: '0.9rem',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center'
                    }}
                    onClick={onNewVideo}
                    title="New Video"
                >
                    {isCollapsed ? <Plus size={20} /> : <span className="btn-text">+ New Video</span>}
                </button>
            </div>
            <div className="task-list">
                {tasks.map((t) => {
                    const dateStr = t.task_id.split('_')[0];
                    return (
                        <div
                            key={t.task_id}
                            className={classNames('task-item', { active: taskId === t.task_id })}
                            onClick={() => onSelectTask(t.task_id)}
                            title={`Task ${t.task_id.substring(t.task_id.length - 4)}\n${t.desc}`}
                        >
                            <div className="task-item-title">Task {t.task_id.substring(t.task_id.length - 4)}</div>
                            <div className="task-item-date">{dateStr}</div>
                            <div className={classNames('status-badge', t.state)}>
                                {t.state === 'completed' && <CheckCircle2 size={isCollapsed ? 20 : 12} />}
                                {t.state === 'processing' && <Loader2 className="spinner" size={isCollapsed ? 20 : 12} />}
                                {t.state === 'error' && <AlertCircle size={isCollapsed ? 20 : 12} />}
                                <span className="status-text" style={{ fontSize: '0.75rem' }}>{t.desc}</span>
                            </div>
                        </div>
                    );
                })}
                {tasks.length === 0 && (
                    <div className="empty-text" style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '2rem', fontSize: '0.9rem' }}>
                        No previous tasks found.
                    </div>
                )}
            </div>
        </div>
    );
};
