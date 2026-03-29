'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { ArrowRight, Database, Network, Sparkles } from 'lucide-react';
import type { Dictionary } from '@/app/types';

type ConnectorBrand = {
  name: string;
  logo: string;
};

const connectorRows: ConnectorBrand[][] = [
  [
    { name: 'Notion', logo: '/connectors/knowledge/notion.svg' },
    { name: 'Slack', logo: '/connectors/channels/slack.svg' },
    { name: 'GitHub', logo: '/connectors/development/github.svg' },
    { name: 'Linear', logo: '/connectors/development/linear.svg' },
    { name: 'Figma', logo: '/connectors/design/figma.svg' },
    { name: 'Google Drive', logo: '/connectors/google-workspace/google-drive.svg' },
    { name: 'Dropbox', logo: '/connectors/storage/dropbox.svg' },
  ],
  [
    { name: 'Confluence', logo: '/connectors/knowledge/confluence.svg' },
    { name: 'Lark', logo: '/connectors/channels/lark.svg' },
    { name: 'Jira', logo: '/connectors/development/jira.svg' },
    { name: 'Zoom', logo: '/connectors/collaboration/zoom.svg' },
    { name: 'Microsoft Teams', logo: '/connectors/collaboration/microsoft-teams.svg' },
    { name: 'Miro', logo: '/connectors/design/miro.svg' },
    { name: 'Obsidian', logo: '/connectors/knowledge/obsidian.svg' },
  ],
  [
    { name: 'PostgreSQL', logo: '/connectors/data/postgresql.svg' },
    { name: 'Supabase', logo: '/connectors/data/supabase.svg' },
    { name: 'Airtable', logo: '/connectors/data/airtable.svg' },
    { name: 'Shopify', logo: '/connectors/business/shopify.svg' },
    { name: 'Zendesk', logo: '/connectors/business/zendesk.svg' },
    { name: 'Gmail', logo: '/connectors/google-workspace/gmail.svg' },
    { name: 'Google Docs', logo: '/connectors/google-workspace/google-docs.svg' },
    { name: 'Google Sheets', logo: '/connectors/google-workspace/google-sheets.svg' },
  ],
];

const featureIcons = [Database, Network, Sparkles] as const;

const marqueeDirections = ['left', 'right', 'left'] as const;

export default function ConnectClient({ dict }: { dict: Dictionary }) {
  return (
    <div className='min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#f6f7fb_0%,#eef1f4_38%,#ffffff_100%)] px-4 py-20'>
      <div className='container-custom'>
        <section className='relative overflow-hidden rounded-[36px] border border-gray-200 bg-white/88 px-6 py-10 shadow-[0_28px_100px_rgba(15,23,42,0.08)] backdrop-blur md:px-10 md:py-14'>
          <div className='absolute inset-x-12 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(17,24,39,0.18),transparent)]' />
          <div className='grid gap-10 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] xl:items-stretch'>
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className='inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-gray-500'>
                <span className='h-2 w-2 rounded-full bg-black' />
                {dict.connect.badge}
              </div>
              <h1 className='mt-6 max-w-4xl text-4xl font-semibold tracking-[-0.04em] text-black md:text-6xl'>
                {dict.connect.title}
              </h1>
              <p className='mt-5 max-w-2xl text-base leading-8 text-gray-600 md:text-lg'>
                {dict.connect.description}
              </p>

              <div className='mt-8 flex flex-wrap gap-3'>
                {dict.connect.highlights.map((item) => (
                  <div
                    key={item}
                    className='rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm'
                  >
                    {item}
                  </div>
                ))}
              </div>

              <div className='mt-10 grid gap-4 md:grid-cols-3'>
                {dict.connect.features.map((feature, index) => {
                  const Icon = featureIcons[index] ?? Sparkles;
                  return (
                    <div
                      key={feature.title}
                      className='rounded-[24px] border border-gray-200 bg-[linear-gradient(180deg,#ffffff_0%,#f7f8fa_100%)] p-5'
                    >
                      <div className='flex h-11 w-11 items-center justify-center rounded-2xl bg-black text-white'>
                        <Icon size={18} />
                      </div>
                      <div className='mt-4 text-lg font-semibold tracking-tight text-black'>{feature.title}</div>
                      <p className='mt-2 text-sm leading-6 text-gray-600'>{feature.desc}</p>
                    </div>
                  );
                })}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.55, delay: 0.08 }}
              className='relative h-full'
            >
              <div className='absolute -inset-4 rounded-[32px] bg-[radial-gradient(circle_at_center,rgba(17,24,39,0.07),transparent_64%)] blur-2xl' />
              <div className='relative flex h-full flex-col overflow-hidden rounded-[32px] border border-gray-200 bg-[#f5f7fa] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]'>
                <div className='flex items-center justify-between gap-3 rounded-[22px] border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 shadow-sm'>
                  <span className='font-medium text-black'>{dict.connect.marquee_label}</span>
                  <span>{dict.connect.marquee_hint}</span>
                </div>

                <div className='mt-5 flex flex-1 flex-col justify-between gap-4'>
                  <div className='space-y-4'>
                    {connectorRows.map((row, index) => (
                      <ConnectorMarquee
                        key={row.map((item) => item.name).join('-')}
                        items={row}
                        direction={marqueeDirections[index]}
                        duration={20 + index * 3}
                      />
                    ))}
                  </div>

                  <div className='rounded-[24px] border border-gray-200 bg-white px-5 py-5 shadow-sm'>
                    <div className='text-xs font-semibold uppercase tracking-[0.24em] text-gray-400'>
                      {dict.connect.connector_story_label}
                    </div>
                    <div className='mt-3 text-2xl font-semibold tracking-tight text-black'>
                      {dict.connect.connector_story_title}
                    </div>
                    <p className='mt-3 text-sm leading-7 text-gray-600'>{dict.connect.connector_story_body}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <section className='mt-10 grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]'>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.12 }}
            className='rounded-[30px] border border-gray-200 bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f6_100%)] p-8 text-black shadow-[0_28px_80px_rgba(15,23,42,0.08)]'
          >
            <div className='inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 text-xs uppercase tracking-[0.24em] text-gray-500 shadow-sm'>
              {dict.connect.panel_label}
            </div>
            <h2 className='mt-5 text-3xl font-semibold tracking-tight'>{dict.connect.panel_title}</h2>
            <p className='mt-4 max-w-xl text-sm leading-7 text-gray-600'>{dict.connect.panel_body}</p>

            <div className='mt-8 space-y-4'>
              {dict.connect.workflow.map((item, index) => (
                <div
                  key={item.title}
                  className='flex items-start gap-4 rounded-[22px] border border-gray-200 bg-white px-4 py-4 shadow-sm'
                >
                  <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black text-sm font-semibold text-white'>
                    {index + 1}
                  </div>
                  <div>
                    <div className='text-base font-semibold text-black'>{item.title}</div>
                    <p className='mt-1 text-sm leading-6 text-gray-600'>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.16 }}
            className='grid gap-5'
          >
            {dict.connect.use_cases.map((item) => (
              <div
                key={item.title}
                className='group rounded-[28px] border border-gray-200 bg-white px-6 py-6 shadow-[0_18px_48px_rgba(15,23,42,0.06)] transition-transform duration-200 hover:-translate-y-1'
              >
                <div className='flex items-start justify-between gap-4'>
                  <div>
                    <div className='text-sm font-semibold uppercase tracking-[0.22em] text-gray-400'>
                      {dict.connect.use_case_label}
                    </div>
                    <h3 className='mt-3 text-2xl font-semibold tracking-tight text-black'>{item.title}</h3>
                  </div>
                  <div className='flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-100 text-black transition-colors duration-200 group-hover:bg-black group-hover:text-white'>
                    <ArrowRight size={18} />
                  </div>
                </div>
                <p className='mt-4 text-sm leading-7 text-gray-600'>{item.desc}</p>
              </div>
            ))}
          </motion.div>
        </section>
      </div>
    </div>
  );
}

function ConnectorMarquee({
  items,
  direction,
  duration,
}: {
  items: ConnectorBrand[];
  direction: 'left' | 'right';
  duration: number;
}) {
  const repeated = [...items, ...items];
  const initialX = direction === 'left' ? '0%' : '-50%';
  const animateX = direction === 'left' ? '-50%' : '0%';

  return (
    <div className='overflow-hidden rounded-[24px] border border-gray-200 bg-white py-3 shadow-sm'>
      <motion.div
        className='flex w-max gap-3 px-3'
        initial={{ x: initialX }}
        animate={{ x: animateX }}
        transition={{ duration, ease: 'linear', repeat: Infinity }}
      >
        {repeated.map((item, index) => (
          <div
            key={`${item.name}-${index}`}
            className='flex shrink-0 items-center justify-center gap-3 rounded-[18px] border border-gray-200 bg-[linear-gradient(180deg,#ffffff_0%,#f4f5f7_100%)] px-4 py-3 shadow-[0_10px_30px_rgba(15,23,42,0.05)]'
          >
            <div className='flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-gray-200 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]'>
              <Image src={item.logo} alt='' width={24} height={24} className='h-6 w-6 object-contain' />
            </div>
            <div className='flex items-center'>
              <span className='block text-center text-sm font-medium tracking-tight text-gray-700'>{item.name}</span>
            </div>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
