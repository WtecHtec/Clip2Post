import React from 'react';
import classNames from 'classnames';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import type { TaskOverview } from '../api';

interface SidebarProps {
    tasks: TaskOverview[];
    taskId: string | null;
    onSelectTask: (id: string) => void;
    onNewVideo: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ tasks, taskId, onSelectTask, onNewVideo }) => {
    return (
        <div className="sidebar">
            <div className="sidebar-header">
                <h2>Task History</h2>
                <button
                    className="btn-primary"
                    style={{ marginTop: '1rem', width: '100%', padding: '0.5rem', fontSize: '0.9rem' }}
                    onClick={onNewVideo}
                >
                    + New Video
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
                        >
                            <div className="task-item-title">Task {t.task_id.substring(t.task_id.length - 4)}</div>
                            <div className="task-item-date">{dateStr}</div>
                            <div className={classNames('status-badge', t.state)}>
                                {t.state === 'completed' && <CheckCircle2 size={12} />}
                                {t.state === 'processing' && <Loader2 className="spinner" size={12} />}
                                {t.state === 'error' && <AlertCircle size={12} />}
                                <span style={{ fontSize: '0.75rem' }}>{t.desc}</span>
                            </div>
                        </div>
                    );
                })}
                {tasks.length === 0 && (
                    <div style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '2rem', fontSize: '0.9rem' }}>
                        No previous tasks found.
                    </div>
                )}
            </div>
        </div>
    );
};
