'use client';

import { useState } from 'react';
import { setUserCookie } from '@/lib/cookie-store';
import { Settings, CheckCircle, ExternalLink, X } from 'lucide-react';

interface CookieSetupProps {
    onComplete: () => void;
    isModal?: boolean;
    onClose?: () => void;
}

export function CookieSetup({ onComplete, isModal = false, onClose }: CookieSetupProps) {
    const [cookie, setCookie] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const handleSave = () => {
        const trimmed = cookie.trim();

        if (!trimmed) {
            setError('请输入 Cookie');
            return;
        }

        // Basic validation: should contain wr_vid or wr_skey
        if (!trimmed.includes('wr_vid') && !trimmed.includes('wr_skey')) {
            setError('Cookie 格式不正确，请确保包含 wr_vid 或 wr_skey');
            return;
        }

        setUserCookie(trimmed);
        setSuccess(true);
        setError('');

        setTimeout(() => {
            onComplete();
        }, 1000);
    };

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="glass-panel w-full max-w-lg p-8 rounded-3xl border border-white/10 relative">

                {isModal && onClose && (
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-white/40 hover:text-white/80 transition-colors"
                    >
                        <X size={20} />
                    </button>
                )}

                <div className="flex items-center gap-3 mb-6">
                    <div className="bg-blue-500/20 p-3 rounded-xl">
                        <Settings className="text-blue-400" size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">配置微信读书 Cookie</h2>
                        <p className="text-sm text-white/50">首次使用需要配置</p>
                    </div>
                </div>

                {success ? (
                    <div className="flex flex-col items-center py-8 text-center">
                        <CheckCircle className="text-green-400 mb-4" size={48} />
                        <p className="text-lg text-white">配置成功！</p>
                        <p className="text-sm text-white/50 mt-2">正在加载你的阅读笔记...</p>
                    </div>
                ) : (
                    <>
                        <div className="mb-4">
                            <label className="block text-sm text-white/70 mb-2">
                                微信读书 Cookie
                            </label>
                            <textarea
                                value={cookie}
                                onChange={(e) => {
                                    setCookie(e.target.value);
                                    setError('');
                                }}
                                placeholder="粘贴你的微信读书 Cookie..."
                                className="w-full h-32 bg-white/5 border border-white/10 rounded-xl p-4 text-white/90 text-sm font-mono placeholder:text-white/30 focus:outline-none focus:border-blue-500/50 resize-none"
                            />
                            {error && (
                                <p className="text-red-400 text-sm mt-2">{error}</p>
                            )}
                        </div>

                        <div className="bg-white/5 rounded-xl p-4 mb-6">
                            <p className="text-sm text-white/70 mb-2">📖 如何获取 Cookie？</p>
                            <ol className="text-xs text-white/50 space-y-1 list-decimal list-inside">
                                <li>在电脑浏览器打开 <a href="https://weread.qq.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline inline-flex items-center gap-1">weread.qq.com <ExternalLink size={10} /></a></li>
                                <li>登录你的微信读书账号</li>
                                <li>按 F12 打开开发者工具，切换到「网络/Network」标签</li>
                                <li>刷新页面，点击任意请求，在「请求标头/Headers」中找到 Cookie</li>
                                <li>复制整个 Cookie 值粘贴到上方</li>
                            </ol>
                        </div>

                        <button
                            onClick={handleSave}
                            className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-medium rounded-xl transition-all duration-300 transform hover:scale-[1.02]"
                        >
                            保存并开始使用
                        </button>

                        <p className="text-xs text-white/30 text-center mt-4">
                            Cookie 仅保存在你的浏览器本地，不会上传到任何服务器
                        </p>
                    </>
                )}
            </div>
        </div>
    );
}
