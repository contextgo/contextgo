'use client';

import { motion } from 'framer-motion';
import { Apple, ArrowUpRight, Download, Laptop, LucideIcon, Monitor, ShieldCheck, Smartphone } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Dictionary } from '@/app/types';
import type { DownloadEntry, ReleaseSnapshot } from '@/lib/releases';

const iconMap: Record<DownloadEntry['id'], LucideIcon> = {
  macos: Apple,
  windows: Laptop,
  linux: Monitor,
  android: Smartphone,
  ios: Smartphone,
  harmony: ShieldCheck,
};

const statusClassMap: Record<DownloadEntry['status'], string> = {
  direct: 'bg-black text-white',
  official: 'bg-gray-900 text-white',
  pending: 'bg-gray-100 text-gray-700',
};

const formatDate = (value: string | null, lang: string, fallback: string): string => {
  if (!value) {
    return fallback;
  }

  return new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
};

const formatFileSize = (value: number | null, lang: string, fallback: string): string => {
  if (value === null) {
    return fallback;
  }

  return (
    new Intl.NumberFormat(lang === 'zh' ? 'zh-CN' : 'en-US', {
      maximumFractionDigits: 1,
      minimumFractionDigits: value >= 1024 * 1024 * 1024 ? 1 : 0,
    }).format(value / (1024 * 1024)) + (lang === 'zh' ? ' MB' : ' MB')
  );
};

export default function DownloadCenter({
  dict,
  lang,
  snapshot,
}: {
  dict: Dictionary;
  lang: string;
  snapshot: ReleaseSnapshot;
}) {
  const publishedAt = formatDate(snapshot.publishedAt, lang, dict.download.version_pending);
  const manifestUpdatedAt = formatDate(snapshot.manifestGeneratedAt, lang, dict.download.manifest_pending);
  const sourceLabel =
    snapshot.source === 'release'
      ? dict.download.source_release
      : snapshot.source === 'tag'
        ? dict.download.source_tag
        : dict.download.source_none;
  const checksumLabel = snapshot.checksumsAvailable ? dict.download.checksum_available : dict.download.checksum_missing;

  return (
    <div className='min-h-screen bg-white px-4 py-20'>
      <div className='mx-auto flex max-w-7xl flex-col gap-12'>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className='rounded-[32px] border border-gray-200 bg-[linear-gradient(135deg,#ffffff_0%,#f6f7f9_100%)] px-8 py-10 shadow-[0_20px_60px_rgba(15,23,42,0.08)] md:px-12'
        >
          <div className='flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between'>
            <div className='max-w-3xl'>
              <div className='mb-4 inline-flex rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-gray-500'>
                {dict.download.center_badge}
              </div>
              <h1 className='text-4xl font-bold tracking-tight text-black md:text-5xl'>{dict.download.title}</h1>
              <p className='mt-4 max-w-2xl text-base leading-7 text-gray-600'>{dict.download.description}</p>
            </div>
            <div className='grid gap-3 rounded-[24px] border border-gray-200 bg-white p-5 shadow-sm md:grid-cols-2 xl:min-w-[420px]'>
              <Metric label={dict.download.version_label} value={snapshot.version || dict.download.version_pending} />
              <Metric label={dict.download.updated_label} value={publishedAt} />
              <Metric label={dict.download.source_label} value={sourceLabel} />
              <Metric label={dict.download.checksum_label} value={checksumLabel} />
            </div>
          </div>

          <div className='mt-6 flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center'>
            <a
              href={snapshot.releaseUrl}
              target='_blank'
              rel='noopener noreferrer'
              className='inline-flex items-center justify-center gap-2 rounded-full bg-black px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-800'
            >
              <ArrowUpRight size={16} />
              {dict.download.release_notes_action}
            </a>
            <div className='rounded-full border border-gray-200 px-4 py-3 text-sm text-gray-600'>
              {dict.download.release_source_note.replace('{{repo}}', snapshot.repository)}
            </div>
            <div className='rounded-full border border-gray-200 px-4 py-3 text-sm text-gray-600'>
              {dict.download.manifest_note.replace('{{date}}', manifestUpdatedAt)}
            </div>
          </div>
        </motion.div>

        <div className='grid gap-6 lg:grid-cols-2 xl:grid-cols-3'>
          {snapshot.entries.map((entry, index) => {
            const Icon = iconMap[entry.id];

            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className='group flex h-full flex-col rounded-[28px] border border-gray-200 bg-white p-7 shadow-[0_16px_40px_rgba(15,23,42,0.05)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_20px_48px_rgba(15,23,42,0.08)]'
              >
                <div className='flex items-start justify-between gap-4'>
                  <div className='flex h-14 w-14 items-center justify-center rounded-[18px] bg-gray-100 text-black'>
                    <Icon size={28} />
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusClassMap[entry.status]}`}>
                    {entry.channel}
                  </span>
                </div>

                <div className='mt-6'>
                  <h2 className='text-2xl font-semibold tracking-tight text-black'>{entry.title}</h2>
                  <p className='mt-3 text-sm leading-6 text-gray-600'>{entry.summary}</p>
                </div>

                <div className='mt-8 flex flex-col gap-3'>
                  {entry.actions.map((action) => (
                    <a
                      key={`${entry.id}-${action.label}`}
                      href={action.href}
                      target={action.external ? '_blank' : undefined}
                      rel={action.external ? 'noopener noreferrer' : undefined}
                      className={
                        action.emphasis === 'primary'
                          ? 'inline-flex items-center justify-center gap-2 rounded-full bg-black px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-800'
                          : 'inline-flex items-center justify-center gap-2 rounded-full border border-gray-200 px-5 py-3 text-sm font-medium text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50'
                      }
                    >
                      {action.emphasis === 'primary' ? <Download size={16} /> : <ArrowUpRight size={16} />}
                      {action.label}
                    </a>
                  ))}
                </div>

                <div className='mt-8 flex flex-1 flex-col gap-4'>
                  <Section title={dict.download.system_requirements_label}>
                    <BulletList items={entry.systemRequirements} />
                  </Section>

                  <Section title={dict.download.permissions_label}>
                    <BulletList items={entry.permissions} />
                  </Section>

                  <Section title={dict.download.asset_block_label}>
                    {entry.assets.length > 0 ? (
                      <div className='flex flex-col gap-3'>
                        {entry.assets.map((asset) => (
                          <div
                            key={`${entry.id}-${asset.fileName}`}
                            className='rounded-[20px] border border-gray-200 bg-gray-50 px-4 py-4'
                          >
                            <div className='text-sm font-semibold text-black'>{asset.label}</div>
                            <div className='mt-3 grid gap-2 text-sm text-gray-600'>
                              <AssetRow label={dict.download.asset_file_label} value={asset.fileName} monospace />
                              <AssetRow
                                label={dict.download.asset_size_label}
                                value={formatFileSize(asset.sizeBytes, lang, dict.download.asset_unknown)}
                              />
                              <AssetRow
                                label={dict.download.sha256_label}
                                value={asset.sha256 || dict.download.sha256_missing}
                                monospace
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className='rounded-[20px] border border-dashed border-gray-200 bg-gray-50 px-4 py-4 text-sm text-gray-500'>
                        {dict.download.no_direct_asset}
                      </div>
                    )}
                  </Section>
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className='grid gap-4 rounded-[28px] border border-gray-200 bg-gray-50 p-6 md:grid-cols-3'>
          <InfoBlock title={dict.download.note_release.title} body={dict.download.note_release.body} />
          <InfoBlock title={dict.download.note_ios.title} body={dict.download.note_ios.body} />
          <InfoBlock title={dict.download.note_harmony.title} body={dict.download.note_harmony.body} />
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className='text-xs uppercase tracking-[0.18em] text-gray-400'>{label}</div>
      <div className='mt-1 text-sm font-medium text-black'>{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className='text-xs uppercase tracking-[0.18em] text-gray-400'>{title}</div>
      <div className='mt-3'>{children}</div>
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className='space-y-2 pl-5 text-sm leading-6 text-gray-600'>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function AssetRow({ label, value, monospace = false }: { label: string; value: string; monospace?: boolean }) {
  return (
    <div className='grid gap-1 sm:grid-cols-[100px_minmax(0,1fr)] sm:items-start'>
      <div className='text-xs uppercase tracking-[0.14em] text-gray-400'>{label}</div>
      <div className={monospace ? 'break-all font-mono text-xs text-gray-700' : 'text-sm text-gray-700'}>{value}</div>
    </div>
  );
}

function InfoBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className='rounded-[20px] border border-white bg-white px-5 py-4 shadow-sm'>
      <div className='text-sm font-semibold text-black'>{title}</div>
      <div className='mt-2 text-sm leading-6 text-gray-600'>{body}</div>
    </div>
  );
}
