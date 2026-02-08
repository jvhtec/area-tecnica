import React, { useState } from 'react';
import { X, MessageSquare } from 'lucide-react';
import { MessagesList } from '@/components/messages/MessagesList';
import { DirectMessagesList } from '@/components/messages/DirectMessagesList';
import { SendMessage } from '@/components/messages/SendMessage';
import { Theme } from './types';

interface MessagesModalProps {
    theme: Theme;
    isDark: boolean;
    userProfile: any;
    onClose: () => void;
}

export const MessagesModal = ({ theme, isDark, userProfile, onClose }: MessagesModalProps) => {
    const [activeTab, setActiveTab] = useState<'department' | 'direct'>('department');
    const department = userProfile?.department || null;

    return (
        <div className={`fixed inset-0 z-[70] flex items-center justify-center ${theme.modalOverlay} px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] animate-in fade-in duration-200`}>
            <div className={`w-full max-w-2xl max-h-[85vh] ${isDark ? 'bg-[#0f1219]' : 'bg-white'} rounded-2xl border ${theme.divider} shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col`}>
                {/* Header */}
                <div className={`p-4 border-b ${theme.divider} flex justify-between items-center shrink-0`}>
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-purple-500 text-white">
                            <MessageSquare size={18} />
                        </div>
                        <h2 className={`text-lg font-bold ${theme.textMain}`}>Mensajes</h2>
                    </div>
                    <button onClick={onClose} className={`p-2 ${theme.textMuted} hover:${theme.textMain} rounded-full transition-colors`}>
                        <X size={20} />
                    </button>
                </div>

                {/* Tab switcher */}
                <div className={`flex border-b ${theme.divider} shrink-0`}>
                    <button
                        onClick={() => setActiveTab('department')}
                        className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'department'
                            ? `${theme.textMain} border-b-2 border-purple-500`
                            : `${theme.textMuted} hover:${theme.textMain}`
                            }`}
                    >
                        Departamento
                    </button>
                    <button
                        onClick={() => setActiveTab('direct')}
                        className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'direct'
                            ? `${theme.textMain} border-b-2 border-purple-500`
                            : `${theme.textMuted} hover:${theme.textMain}`
                            }`}
                    >
                        Directos
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {activeTab === 'department' ? (
                        <div className="space-y-4">
                            {department && <SendMessage department={department} />}
                            <MessagesList theme={theme} isDark={isDark} />
                        </div>
                    ) : (
                        <DirectMessagesList theme={theme} isDark={isDark} />
                    )}
                </div>
            </div>
        </div>
    );
};
