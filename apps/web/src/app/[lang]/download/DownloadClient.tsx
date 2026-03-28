'use client';

import { motion } from 'framer-motion';
import { Apple, Download, Monitor, LucideIcon } from 'lucide-react';
import { Dictionary } from '@/app/types';

export default function DownloadClient({ dict }: { dict: Dictionary }) {
  return (
    <div className="min-h-screen bg-white py-20 px-4 flex flex-col items-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center max-w-2xl mb-12"
      >
        <h1 className="text-4xl font-bold mb-4">{dict.download.title}</h1>
        <p className="text-gray-600">
          {dict.download.description}
        </p>
      </motion.div>

      <div className="grid md:grid-cols-2 gap-8 max-w-4xl w-full">
        <DownloadCard 
          os="macOS" 
          icon={Apple} 
          arch={dict.download.mac_arch}
          link="https://github.com/Timax00/ContextGo/releases/latest"
          btnText={dict.download.download_action}
        />
        <DownloadCard 
          os="Windows" 
          icon={Monitor} 
          arch={dict.download.win_arch}
          link="https://github.com/Timax00/ContextGo/releases/latest"
          btnText={dict.download.download_action}
        />
      </div>
    </div>
  );
}

function DownloadCard({ os, icon: Icon, arch, link, btnText }: { os: string, icon: LucideIcon, arch: string, link: string, btnText: string }) {
  return (
    <motion.a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      whileHover={{ y: -5 }}
      className="block bg-brand-light p-8 rounded-2xl border border-transparent hover:border-gray-200 transition-all text-center group"
    >
      <div className="w-16 h-16 bg-white rounded-full mx-auto flex items-center justify-center mb-6 shadow-sm group-hover:shadow-md transition-shadow">
        <Icon size={32} className="text-black" />
      </div>
      <h2 className="text-2xl font-bold mb-2">{os}</h2>
      <p className="text-sm text-gray-500 mb-6">{arch}</p>
      <div className="bg-black text-white py-3 px-6 rounded-full font-medium flex items-center justify-center gap-2 group-hover:bg-gray-800 transition-colors">
        <Download size={18} />
        {btnText}
      </div>
    </motion.a>
  );
}
