'use client';

import { motion } from 'framer-motion';
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { Dictionary } from '@/app/types';

const integrations = [
  { name: 'Claude Code', path: '~/.claude/skills/' },
  { name: 'Cursor', path: '~/.cursor/skills/' },
  { name: 'OpenClaw', path: '~/.openclaw/skills/' },
  { name: 'Windsurf', path: '~/.windsurf/skills/' },
  { name: 'Cline', path: '~/.cline/skills/' },
  { name: 'Gemini Code', path: '~/.gemini/skills/' },
  { name: 'GitHub Copilot', path: '~/.copilot/skills/' },
  { name: 'OpenCode', path: '~/.opencode/skills/' },
  { name: 'Antigravity', path: '~/.gemini/antigravity/skills/' },
  { name: 'Kiro', path: '~/.kiro/skills/' },
  { name: 'Codex CLI', path: '~/.codex/skills/' },
  { name: 'Qoder', path: '~/.qoder/skills/' },
  { name: 'Roo Code', path: '~/.roo/skills/' },
  { name: 'Trae', path: '~/.trae/skills/' },
  { name: 'Continue', path: '~/.continue/skills/' },
];

export default function ConnectClient({ dict }: { dict: Dictionary }) {
  return (
    <div className="min-h-screen bg-brand-light py-20 px-4">
      <div className="container-custom">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-6">{dict.connect.title}</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            {dict.connect.description}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {integrations.map((tool, index) => (
            <IntegrationCard key={tool.name} tool={tool} index={index} desc={dict.connect.card_desc} />
          ))}
        </div>
      </div>
    </div>
  );
}

function IntegrationCard({ tool, index, desc }: { tool: { name: string, path: string }, index: number, desc: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(tool.path);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all group"
    >
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-lg group-hover:text-blue-600 transition-colors">{tool.name}</h3>
      </div>
      <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 flex items-center justify-between gap-3">
        <code className="text-xs text-gray-600 font-mono truncate" title={tool.path}>
          {tool.path}
        </code>
        <button 
          onClick={handleCopy}
          className="text-gray-400 hover:text-black transition-colors"
          title="Copy path"
        >
          {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
        </button>
      </div>
      <p className="text-xs text-gray-400 mt-2">
        {desc}
      </p>
    </motion.div>
  );
}
