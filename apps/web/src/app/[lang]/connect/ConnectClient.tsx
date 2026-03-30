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
    <div className='theme-connect-gradient min-h-screen overflow-hidden px-4 py-20'>
      <div className='container-custom'>
        <section className='theme-surface-primary theme-shadow-soft theme-border relative overflow-hidden rounded-[36px] border px-6 py-10 backdrop-blur md:px-10 md:py-14'>
          <div className='theme-divider-gradient absolute inset-x-12 top-0 h-px' />
          <div className='grid gap-10 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] xl:items-start'>
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <div className='theme-button-secondary theme-text-tertiary inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em]'>
                <span className='h-2 w-2 rounded-full bg-[var(--surface-accent)]' />
                {dict.connect.badge}
              </div>
              <h1 className='theme-text-primary mt-6 max-w-4xl text-4xl font-semibold tracking-[-0.04em] md:text-6xl'>
                {dict.connect.title}
              </h1>
              <p className='theme-text-secondary mt-5 max-w-2xl text-base leading-8 md:text-lg'>
                {dict.connect.description}
              </p>

              <div className='mt-8 flex flex-wrap gap-3'>
                {dict.connect.highlights.map((item) => (
                  <div
                    key={item}
                    className='theme-surface-secondary theme-shadow-card theme-border theme-text-secondary rounded-full border px-4 py-2 text-sm font-medium'
                  >
                    {item}
                  </div>
                ))}
              </div>

              <div className='mt-10 grid gap-4 md:grid-cols-3'>
                {dict.connect.features.map((feature, index) => {
                  const Icon = featureIcons[index] ?? Sparkles;
                  return (
                    <div key={feature.title} className='theme-card-gradient theme-border rounded-[24px] border p-5'>
                      <div className='theme-surface-accent flex h-11 w-11 items-center justify-center rounded-2xl'>
                        <Icon size={18} />
                      </div>
                      <div className='theme-text-primary mt-4 text-lg font-semibold tracking-tight'>
                        {feature.title}
                      </div>
                      <p className='theme-text-secondary mt-2 text-sm leading-6'>{feature.desc}</p>
                    </div>
                  );
                })}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.55, delay: 0.08 }}
              className='relative h-full self-stretch xl:pt-[3.9rem]'
            >
              <div className='absolute -inset-4 rounded-[32px] bg-[radial-gradient(circle_at_center,color-mix(in_srgb,var(--surface-accent)_8%,transparent),transparent_64%)] blur-2xl' />
              <div className='theme-panel-gradient theme-border relative flex h-full flex-col overflow-hidden rounded-[32px] border p-5 shadow-[inset_0_1px_0_color-mix(in_srgb,var(--text-inverse)_12%,transparent)]'>
                <div className='theme-surface-secondary theme-shadow-card theme-border theme-text-secondary flex items-center justify-between gap-3 rounded-[22px] border px-4 py-3 text-sm'>
                  <span className='theme-text-primary font-medium'>{dict.connect.marquee_label}</span>
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

                  <div className='theme-surface-secondary theme-shadow-card theme-border rounded-[24px] border px-5 py-5'>
                    <div className='theme-text-tertiary text-xs font-semibold uppercase tracking-[0.24em]'>
                      {dict.connect.connector_story_label}
                    </div>
                    <div className='theme-text-primary mt-3 text-2xl font-semibold tracking-tight'>
                      {dict.connect.connector_story_title}
                    </div>
                    <p className='theme-text-secondary mt-3 text-sm leading-7'>{dict.connect.connector_story_body}</p>
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
            className='theme-panel-gradient theme-shadow-soft theme-border rounded-[30px] border p-8'
          >
            <div className='theme-surface-secondary theme-shadow-card theme-border theme-text-tertiary inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs uppercase tracking-[0.24em]'>
              {dict.connect.panel_label}
            </div>
            <h2 className='theme-text-primary mt-5 text-3xl font-semibold tracking-tight'>
              {dict.connect.panel_title}
            </h2>
            <p className='theme-text-secondary mt-4 max-w-xl text-sm leading-7'>{dict.connect.panel_body}</p>

            <div className='mt-8 space-y-4'>
              {dict.connect.workflow.map((item, index) => (
                <div
                  key={item.title}
                  className='theme-surface-secondary theme-shadow-card theme-border flex items-start gap-4 rounded-[22px] border px-4 py-4'
                >
                  <div className='theme-surface-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold'>
                    {index + 1}
                  </div>
                  <div>
                    <div className='theme-text-primary text-base font-semibold'>{item.title}</div>
                    <p className='theme-text-secondary mt-1 text-sm leading-6'>{item.desc}</p>
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
                className='theme-surface-secondary theme-shadow-card theme-border group rounded-[28px] border px-6 py-6 transition-transform duration-200 hover:-translate-y-1'
              >
                <div className='flex items-start justify-between gap-4'>
                  <div>
                    <div className='theme-text-tertiary text-sm font-semibold uppercase tracking-[0.22em]'>
                      {dict.connect.use_case_label}
                    </div>
                    <h3 className='theme-text-primary mt-3 text-2xl font-semibold tracking-tight'>{item.title}</h3>
                  </div>
                  <div className='theme-surface-tertiary theme-text-primary flex h-11 w-11 items-center justify-center rounded-2xl transition-colors duration-200 group-hover:bg-[var(--surface-accent)] group-hover:text-[var(--text-inverse)]'>
                    <ArrowRight size={18} />
                  </div>
                </div>
                <p className='theme-text-secondary mt-4 text-sm leading-7'>{item.desc}</p>
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
    <div className='theme-surface-secondary theme-shadow-card theme-border overflow-hidden rounded-[24px] border py-3'>
      <motion.div
        className='flex w-max gap-3 px-3'
        initial={{ x: initialX }}
        animate={{ x: animateX }}
        transition={{ duration, ease: 'linear', repeat: Infinity }}
      >
        {repeated.map((item, index) => (
          <div
            key={`${item.name}-${index}`}
            className='theme-card-gradient theme-border theme-shadow-card inline-flex shrink-0 items-center gap-2.5 rounded-[18px] border px-3.5 py-2.5'
          >
            <div className='theme-surface-secondary theme-border flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border shadow-[inset_0_1px_0_color-mix(in_srgb,var(--text-inverse)_18%,transparent)]'>
              <Image src={item.logo} alt='' width={24} height={24} className='h-6 w-6 object-contain' />
            </div>
            <span className='theme-text-primary block whitespace-nowrap text-center text-sm font-medium tracking-tight'>
              {item.name}
            </span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
