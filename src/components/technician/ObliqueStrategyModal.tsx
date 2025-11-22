import React, { useState } from 'react';
import { X, Lightbulb, Sparkles, Shuffle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OBLIQUE_STRATEGIES, ObliqueStrategy } from './obliqueStrategies';
import { Theme } from './types';

interface ObliqueStrategyModalProps {
    theme: Theme;
    isDark: boolean;
    onClose: () => void;
}

export const ObliqueStrategyModal = ({ theme, isDark, onClose }: ObliqueStrategyModalProps) => {
    const [currentStrategy, setCurrentStrategy] = useState<ObliqueStrategy>(
        () => OBLIQUE_STRATEGIES[Math.floor(Math.random() * OBLIQUE_STRATEGIES.length)]
    );
    const [isAnimating, setIsAnimating] = useState(false);

    const drawNewCard = () => {
        setIsAnimating(true);
        setTimeout(() => {
            setCurrentStrategy(OBLIQUE_STRATEGIES[Math.floor(Math.random() * OBLIQUE_STRATEGIES.length)]);
            setIsAnimating(false);
        }, 300);
    };

    return (
        <div className={`fixed inset-0 z-[70] flex items-center justify-center ${theme.modalOverlay} p-4 animate-in fade-in duration-200`}>
            <div className={`w-full max-w-sm ${isDark ? 'bg-[#0f1219]' : 'bg-white'} rounded-2xl border ${theme.divider} shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200`}>
                {/* Header */}
                <div className={`p-4 border-b ${theme.divider} flex justify-between items-center bg-gradient-to-r ${isDark ? 'from-purple-900/30 to-blue-900/30' : 'from-purple-100 to-blue-100'}`}>
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 text-white">
                            <Lightbulb size={18} />
                        </div>
                        <div>
                            <h2 className={`text-lg font-bold ${theme.textMain}`}>Estrategias Oblicuas</h2>
                            <p className={`text-xs ${theme.textMuted}`}>Brian Eno & Peter Schmidt</p>
                        </div>
                    </div>
                    <button onClick={onClose} className={`p-2 ${theme.textMuted} hover:${theme.textMain} rounded-full transition-colors`}>
                        <X size={20} />
                    </button>
                </div>

                {/* Card Content */}
                <div className="p-6">
                    <div className={`relative min-h-[200px] rounded-xl border-2 border-dashed ${isDark ? 'border-purple-500/30 bg-purple-500/5' : 'border-purple-200 bg-purple-50'} p-6 flex flex-col items-center justify-center text-center transition-all duration-300 ${isAnimating ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
                        <Sparkles size={24} className={`mb-4 ${isDark ? 'text-purple-400' : 'text-purple-500'}`} />
                        <p className={`text-lg font-bold ${theme.textMain} mb-3 leading-relaxed`}>
                            {currentStrategy.spanish}
                        </p>
                        <p className={`text-sm ${theme.textMuted} italic`}>
                            "{currentStrategy.english}"
                        </p>
                    </div>
                </div>

                {/* Actions */}
                <div className={`p-4 border-t ${theme.divider} flex gap-3`}>
                    <Button
                        variant="outline"
                        className="flex-1"
                        onClick={onClose}
                    >
                        Cerrar
                    </Button>
                    <Button
                        className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white"
                        onClick={drawNewCard}
                        disabled={isAnimating}
                    >
                        <Shuffle size={16} className={`mr-2 ${isAnimating ? 'animate-spin' : ''}`} />
                        Nueva carta
                    </Button>
                </div>
            </div>
        </div>
    );
};
