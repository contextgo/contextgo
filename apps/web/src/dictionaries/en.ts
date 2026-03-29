export const en = {
  navbar: {
    product: 'Introduction',
    connect: 'Connect',
    download: 'Download',
  },
  hero: {
    title_start: 'Master Your Context,',
    title_end: 'Unleash AI Potential.',
    description:
      'The missing bridge between your local knowledge and Large Language Models. Manage your private context securely and serve it to any AI agent via standard protocols.',
    download_btn: 'Download Free',
    connect_btn: 'Connect AI',
  },
  philosophy: {
    title: 'Why ContextGo?',
    description_start:
      "In the era of Large Language Models, the model's intelligence is only as good as the context you provide.",
    description_end:
      'ContextGo is built on the belief that humans need a dedicated, local-first tool to curate, edit, and organize their "external brain" specifically for AI consumption.',
    points: ['Local-first & Private', 'Optimized for LLM Context Windows', 'Standardized Protocols (MCP, Skills)'],
    features: {
      private: { title: 'Private', desc: 'Your data stays on your device. Always.' },
      editor: { title: 'Editor', desc: 'Lightweight markdown editor for quick context curation.' },
      connect: { title: 'Connect', desc: 'Seamlessly pipe context to Claude, Cursor, and more.' },
      manage: { title: 'Manage', desc: 'Organize knowledge bases efficiently.' },
    },
  },
  connect: {
    title: 'Connect Your AI',
    description:
      'ContextGo bridges the gap between your local knowledge and AI agents. Connect seamlessly to your favorite tools and empower them with your private context.',
    card_desc: 'Target directory for skills integration.',
  },
  download: {
    center_badge: 'Multi-Platform Download Center',
    title: 'Get ContextGo',
    description:
      'Download the latest tagged ContextGo release from one page. Desktop, Linux, and Android builds can ship as direct downloads, while iPhone/iPad and HarmonyOS can point users to the official install path you configure.',
    mac_arch: 'Universal (Apple Silicon & Intel)',
    win_arch: 'x64 / ARM64',
    download_action: 'Download',
    version_label: 'Current Version',
    version_pending: 'Awaiting tagged release',
    updated_label: 'Updated',
    source_label: 'Source',
    source_none: 'Unavailable',
    checksum_label: 'SHA256 Coverage',
    checksum_available: 'Available',
    checksum_missing: 'Pending manifest',
    manifest_note: 'Release manifest updated: {{date}}',
    manifest_pending: 'Awaiting release manifest',
    system_requirements_label: 'System Requirements',
    permissions_label: 'Permissions',
    asset_block_label: 'Release Assets',
    asset_file_label: 'File',
    asset_size_label: 'Size',
    asset_unknown: 'Unknown',
    sha256_label: 'SHA256',
    sha256_missing: 'Not published yet',
    no_direct_asset: 'No direct-download artifact is published for this platform yet.',
    source_release: 'GitHub Release',
    source_tag: 'Git Tag',
    release_notes_action: 'Open Release Notes',
    release_source_note: 'Release source of truth: {{repo}}',
    note_release: {
      title: 'Desktop, Linux, And Android',
      body: 'Attach signed installers or APK / AAB assets to the GitHub Release. The release manifest keeps filenames, download buttons, sizes, and SHA256 values aligned.',
    },
    note_ios: {
      title: 'iPhone / iPad',
      body: 'Prefer App Store, TestFlight, or web install links instead of public direct IPA hosting.',
    },
    note_harmony: {
      title: 'HarmonyOS',
      body: 'Prefer AppGallery Connect / AppGallery links. If you later attach signed HAP assets, they can still appear as a secondary entry.',
    },
  },
  footer: {
    tagline: 'Manage your context, empower your AI.',
    rights: 'ContextGo. All rights reserved.',
    product: 'Product',
    connect: 'Connect',
    download: 'Download',
    privacy: 'Privacy',
    terms: 'Terms',
  },
  legal: {
    contactEmail: 'support@contextgo.io',
    privacy: {
      title: 'Privacy Policy',
      lastUpdated: 'Last updated: 2026-02-12',
      sections: [
        {
          heading: 'Information We Collect',
          content: [
            'When you sign in with Google or GitHub, we may collect basic profile information such as your name, email address, avatar, and provider account identifier.',
            'We may also collect limited technical and usage data needed to keep the service reliable and secure.',
          ],
        },
        {
          heading: 'How We Use Information',
          content: [
            'We use your information to authenticate your account, provide core product features, protect account security, and troubleshoot service issues.',
            'We do not sell your personal information.',
          ],
        },
        {
          heading: 'Sharing and Disclosure',
          content: [
            'We only share data when necessary to operate the service, comply with legal obligations, or protect users and the platform from abuse.',
            'Third-party identity providers (Google and GitHub) process data according to their own privacy terms.',
          ],
        },
        {
          heading: 'Data Retention',
          content: [
            'We retain personal data only for as long as needed to provide the service, meet legal requirements, and resolve disputes.',
            'When data is no longer required, we delete or anonymize it where reasonably possible.',
          ],
        },
        {
          heading: 'Your Rights',
          content: [
            'You may request access, correction, or deletion of your personal information.',
            'You can revoke Google or GitHub authorization from your provider account settings at any time.',
          ],
        },
        {
          heading: 'Contact Us',
          content: ['For privacy requests or questions, contact us at support@contextgo.io.'],
        },
      ],
    },
    terms: {
      title: 'Terms of Use',
      lastUpdated: 'Last updated: 2026-02-12',
      sections: [
        {
          heading: 'Account and Access',
          content: [
            'You may sign in using supported third-party providers including Google and GitHub.',
            'You are responsible for maintaining the security of your account and the activities performed under it.',
          ],
        },
        {
          heading: 'Acceptable Use',
          content: [
            'You agree not to misuse the service, attempt unauthorized access, disrupt infrastructure, or use the service for unlawful activities.',
            'We may suspend or terminate access for violations of these terms.',
          ],
        },
        {
          heading: 'Intellectual Property',
          content: [
            'The service and related materials are owned by ContextGo or its licensors and are protected by applicable intellectual property laws.',
          ],
        },
        {
          heading: 'Disclaimer and Limitation of Liability',
          content: [
            'The service is provided on an as-is and as-available basis without warranties of any kind.',
            'To the fullest extent permitted by law, ContextGo is not liable for indirect, incidental, or consequential damages arising from use of the service.',
          ],
        },
        {
          heading: 'Payments and Subscriptions',
          content: ['ContextGo currently does not offer subscription billing for this service.'],
        },
        {
          heading: 'Changes to These Terms',
          content: [
            'We may update these terms from time to time. Continued use of the service after updates means you accept the revised terms.',
            'For legal questions, contact support@contextgo.io.',
          ],
        },
      ],
    },
  },
};
