'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Database, Edit3, Share2, Shield, LucideIcon } from 'lucide-react';
import ContextParticles from '@/components/ContextParticles';
import { Dictionary } from '@/app/types';
import type { ContentCard } from '@/lib/site-content';

export default function HomeClient({
  dict,
  lang,
  resources,
}: {
  dict: Dictionary;
  lang: string;
  resources: {
    badge: string;
    title: string;
    description: string;
    cards: ContentCard[];
  };
}) {
  const demoRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: demoRef,
    offset: ['start end', 'center center'],
  });

  const scale = useTransform(scrollYProgress, [0, 1], [0.85, 1]);
  const opacity = useTransform(scrollYProgress, [0, 1], [0.5, 1]);
  const rotateX = useTransform(scrollYProgress, [0, 1], [20, 0]);
  const y = useTransform(scrollYProgress, [0, 1], [100, 0]);

  return (
    <div className='flex flex-col items-center'>
      {/* Hero Section */}
      <section className='theme-hero-gradient theme-text-primary relative flex w-full flex-col items-center overflow-hidden px-4 py-24 text-center md:py-32'>
        {/* Particle Background */}
        <ContextParticles />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className='relative z-10 max-w-4xl space-y-6'
        >
          <h1 className='text-5xl font-bold tracking-tight md:text-7xl'>
            {dict.hero.title_start} <br />
            <span className='theme-text-tertiary'>{dict.hero.title_end}</span>
          </h1>
          <p className='theme-text-secondary mx-auto max-w-2xl text-xl'>{dict.hero.description}</p>
          <div className='flex flex-wrap justify-center gap-4 pt-8'>
            <Link
              href={`/${lang}/download`}
              className='theme-button-primary inline-flex rounded-full px-8 py-3 font-medium transition-all hover:scale-105 active:scale-95'
            >
              {dict.hero.download_btn}
            </Link>
            <Link
              href={`/${lang}/docs`}
              className='theme-button-secondary theme-shadow-card inline-flex rounded-full px-8 py-3 font-medium transition-all'
            >
              {dict.hero.docs_btn}
            </Link>
            <Link
              href={`/${lang}/connect`}
              className='theme-button-secondary theme-shadow-card inline-flex rounded-full px-8 py-3 font-medium transition-all'
            >
              {dict.hero.connect_btn}
            </Link>
          </div>
        </motion.div>

        {/* Demo Placeholder */}
        <div ref={demoRef} className='perspective-1000 relative z-10 mt-20 w-full max-w-5xl'>
          <motion.div
            style={{
              scale,
              opacity,
              rotateX,
              y,
              transformPerspective: 1000,
            }}
            className='theme-surface-primary theme-shadow-soft theme-border group relative overflow-hidden rounded-xl border'
          >
            <Image
              src='/demo.png'
              alt='ContextGo Product Demo'
              width={1920}
              height={1080}
              className='h-auto w-full'
              priority
            />
          </motion.div>
        </div>
      </section>

      {/* Philosophy Section */}
      <section className='theme-page-muted w-full px-4 py-24'>
        <div className='container-custom'>
          <div className='grid items-center gap-16 md:grid-cols-2'>
            <div>
              <h2 className='mb-6 text-3xl font-bold md:text-4xl'>{dict.philosophy.title}</h2>
              <p className='theme-text-secondary mb-6 text-lg leading-relaxed'>
                {dict.philosophy.description_start}
                <br />
                <br />
                <strong>{dict.philosophy.description_end}</strong>
              </p>
              <ul className='space-y-4'>
                {dict.philosophy.points.map((item: string, i: number) => (
                  <li key={i} className='flex items-center gap-3'>
                    <div className='h-2 w-2 rounded-full bg-[var(--surface-accent)]' />
                    <span className='font-medium'>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className='grid grid-cols-2 gap-4'>
              <FeatureCard
                icon={Shield}
                title={dict.philosophy.features.private.title}
                desc={dict.philosophy.features.private.desc}
              />
              <FeatureCard
                icon={Edit3}
                title={dict.philosophy.features.editor.title}
                desc={dict.philosophy.features.editor.desc}
              />
              <FeatureCard
                icon={Share2}
                title={dict.philosophy.features.connect.title}
                desc={dict.philosophy.features.connect.desc}
              />
              <FeatureCard
                icon={Database}
                title={dict.philosophy.features.manage.title}
                desc={dict.philosophy.features.manage.desc}
              />
            </div>
          </div>
        </div>
      </section>

      <section className='theme-page w-full px-4 py-24'>
        <div className='container-custom'>
          <div className='theme-panel-gradient theme-shadow-soft theme-border rounded-[32px] border px-8 py-10 md:px-10 md:py-12'>
            <div className='theme-surface-secondary theme-border theme-text-tertiary inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em]'>
              {resources.badge}
            </div>
            <h2 className='theme-text-primary mt-5 max-w-4xl text-3xl font-semibold tracking-tight md:text-5xl'>
              {resources.title}
            </h2>
            <p className='theme-text-secondary mt-4 max-w-3xl text-base leading-8'>{resources.description}</p>

            <div className='mt-10 grid gap-5 lg:grid-cols-3'>
              {resources.cards.map((card) => (
                <Link
                  key={card.href}
                  href={`/${lang}${card.href}`}
                  className='theme-surface-secondary theme-shadow-card theme-border group rounded-[28px] border px-6 py-6 transition-transform duration-200 hover:-translate-y-1'
                >
                  <div className='theme-text-tertiary text-xs font-semibold uppercase tracking-[0.22em]'>
                    {card.eyebrow}
                  </div>
                  <h3 className='theme-text-primary mt-3 text-2xl font-semibold tracking-tight'>{card.title}</h3>
                  <p className='theme-text-secondary mt-3 text-sm leading-7'>{card.summary}</p>
                  <div className='theme-text-primary mt-5 inline-flex items-center gap-2 text-sm font-medium'>
                    {card.cta}
                    <ArrowRight size={16} />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, desc }: { icon: LucideIcon; title: string; desc: string }) {
  return (
    <div className='theme-card-gradient theme-shadow-card theme-border rounded-2xl border p-6 transition-shadow'>
      <div className='theme-surface-tertiary mb-4 flex h-10 w-10 items-center justify-center rounded-lg'>
        <Icon size={20} />
      </div>
      <h3 className='mb-2 font-bold'>{title}</h3>
      <p className='theme-text-secondary text-sm'>{desc}</p>
    </div>
  );
}
