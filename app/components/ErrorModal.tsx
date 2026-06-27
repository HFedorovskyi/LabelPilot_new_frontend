import React, { useState } from "react";
import Portal from "./Portal";

interface ErrorModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    message: string;
    details?: any;
}

export default function ErrorModal({ isOpen, onClose, title = "Error", message, details }: ErrorModalProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    if (!isOpen) return null;

    const copyToClipboard = () => {
        const text = `${message}\n\nDetails:\n${typeof details === 'object' ? JSON.stringify(details, null, 2) : details}`;
        navigator.clipboard.writeText(text);
        // Could add a toast here, but for now just a console log or subtle interaction is fine
    };

    return (
        <Portal>
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-red-500/30 bg-[#0A0A0B] shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/10 bg-red-500/10 px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/20 text-red-500">
                            ⚠️
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white">{title}</h3>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-white/40 hover:bg-white/10 hover:text-white transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    <p className="text-lg text-white/90 mb-6">{message}</p>

                    {details && (
                        <div className="rounded-xl border border-white/10 bg-black/40 overflow-hidden">
                            <button
                                onClick={() => setIsExpanded(!isExpanded)}
                                className="w-full flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-white/10 transition-colors text-left"
                            >
                                <span className="text-sm font-medium text-white/60">
                                    {isExpanded ? "Hide Details" : "Show Technical Details"}
                                </span>
                                <span className="text-white/40 text-xs">
                                    {isExpanded ? "▲" : "▼"}
                                </span>
                            </button>

                            {isExpanded && (
                                <div className="p-4 border-t border-white/10 overflow-x-auto max-h-[300px] scrollbar-thin scrollbar-thumb-white/10">
                                    <pre className="font-mono text-xs text-red-300 w-full whitespace-pre-wrap break-words">
                                        {typeof details === 'object' ? JSON.stringify(details, null, 2) : String(details)}
                                    </pre>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 border-t border-white/10 bg-white/5 px-6 py-4">
                    <button
                        onClick={copyToClipboard}
                        className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10 transition"
                    >
                        📋 Copy Error
                    </button>
                    <button
                        onClick={onClose}
                        className="rounded-xl bg-white px-6 py-2 text-sm font-bold text-black hover:bg-white/90 transition"
                    >
                        OK
                    </button>
                </div>
            </div>
        </div>
        </Portal>
    );
}
