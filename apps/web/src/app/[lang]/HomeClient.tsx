'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Database, Edit3, Share2, Shield, LucideIcon } from 'lucide-react';
import ContextParticles from '@/components/ContextParticles';
import { Dictionary } from '@/app/types';

export default function HomeClient({ dict, lang }: { dict: Dictionary, lang: string }) {
  const demoRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: demoRef,
    offset: ["start end", "center center"]
  });

  const scale = useTransform(scrollYProgress, [0, 1], [0.85, 1]);
  const opacity = useTransform(scrollYProgress, [0, 1], [0.5, 1]);
  const rotateX = useTransform(scrollYProgress, [0, 1], [20, 0]);
  const y = useTransform(scrollYProgress, [0, 1], [100, 0]);

  return (
    <div className="flex flex-col items-center">
      
      {/* Hero Section */}
      <section className="w-full py-24 md:py-32 bg-white flex flex-col items-center text-center px-4 relative overflow-hidden">
        {/* Particle Background */}
        <ContextParticles />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl space-y-6 relative z-10"
        >
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-black">
            {dict.hero.title_start} <br />
            <span className="text-gray-400">{dict.hero.title_end}</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            {dict.hero.description}
          </p>
          <div className="flex gap-4 justify-center pt-8">
            <Link href={`/${lang}/download`} className="px-8 py-3 bg-black text-white rounded-full font-medium hover:bg-gray-800 transition-all hover:scale-105 active:scale-95">
              {dict.hero.download_btn}
            </Link>
            <Link href={`/${lang}/connect`} className="px-8 py-3 bg-gray-100/80 backdrop-blur-sm text-black rounded-full font-medium hover:bg-gray-200 transition-all">
              {dict.hero.connect_btn}
            </Link>
          </div>
        </motion.div>

        {/* Demo Placeholder */}
        <div ref={demoRef} className="mt-20 w-full max-w-5xl relative z-10 perspective-1000">
          <motion.div 
            style={{ 
              scale, 
              opacity, 
              rotateX, 
              y,
              transformPerspective: 1000
            }}
            className="relative rounded-xl border border-gray-200 shadow-2xl overflow-hidden group"
          >
            <Image 
              src="/demo.png" 
              alt="ContextGo Product Demo" 
              width={1920} 
              height={1080} 
              className="w-full h-auto"
              priority
            />
          </motion.div>
        </div>
      </section>

      {/* Philosophy Section */}
      <section className="w-full py-24 bg-brand-light px-4">
        <div className="container-custom">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">{dict.philosophy.title}</h2>
              <p className="text-lg text-gray-600 mb-6 leading-relaxed">
                {dict.philosophy.description_start}
                <br /><br />
                <strong>{dict.philosophy.description_end}</strong>
              </p>
              <ul className="space-y-4">
                {dict.philosophy.points.map((item: string, i: number) => (
                  <li key={i} className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-black rounded-full" />
                    <span className="font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid grid-cols-2 gap-4">
               <FeatureCard icon={Shield} title={dict.philosophy.features.private.title} desc={dict.philosophy.features.private.desc} />
               <FeatureCard icon={Edit3} title={dict.philosophy.features.editor.title} desc={dict.philosophy.features.editor.desc} />
               <FeatureCard icon={Share2} title={dict.philosophy.features.connect.title} desc={dict.philosophy.features.connect.desc} />
               <FeatureCard icon={Database} title={dict.philosophy.features.manage.title} desc={dict.philosophy.features.manage.desc} />
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}

function FeatureCard({ icon: Icon, title, desc }: { icon: LucideIcon, title: string, desc: string }) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center mb-4 text-black">
        <Icon size={20} />
      </div>
      <h3 className="font-bold mb-2">{title}</h3>
      <p className="text-sm text-gray-500">{desc}</p>
    </div>
  );
}
