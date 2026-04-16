const { themes } = require('prism-react-renderer');

const lightCodeTheme = themes.github;
const darkCodeTheme = themes.dracula;

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'ContextGo Docs',
  tagline: 'Local-first AI Native Workbench documentation',
  url: 'https://docs.contextgo.io',
  baseUrl: '/',
  organizationName: 'contextgo',
  projectName: 'contextgo',
  onBrokenLinks: 'warn',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },
  future: {
    faster: {
      rspackBundler: true,
    },
  },
  i18n: {
    defaultLocale: 'zh-Hans',
    locales: ['zh-Hans', 'en'],
  },
  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          routeBasePath: '/',
          sidebarPath: require.resolve('./sidebars.js'),
          editUrl: 'https://github.com/contextgo/contextgo/tree/main/apps/docs/',
        },
        blog: false,
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      }),
    ],
  ],
  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      navbar: {
        title: 'ContextGo',
        items: [
          { to: '/start-here', label: 'Get Started', position: 'left' },
          { to: '/use-cases', label: 'Workflows', position: 'left' },
          { to: '/workbench', label: 'Workbench', position: 'left' },
          { to: '/context', label: 'Context', position: 'left' },
          { to: '/agents', label: 'Agent System', position: 'left' },
          { to: '/publish', label: 'Publish', position: 'left' },
          { to: '/remote', label: 'Remote', position: 'left' },
          {
            href: 'https://contextgo.io',
            label: 'Main Site',
            position: 'right',
          },
          {
            href: 'https://github.com/contextgo/contextgo',
            label: 'GitHub',
            position: 'right',
          },
          {
            type: 'localeDropdown',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Explore',
            items: [
              { label: 'Get Started', to: '/start-here' },
              { label: 'Workflows', to: '/use-cases' },
              { label: 'Workbench', to: '/workbench' },
              { label: 'Context', to: '/context' },
              { label: 'Publish', to: '/publish' },
            ],
          },
          {
            title: 'Product',
            items: [
              { label: 'ContextGo.io', href: 'https://contextgo.io' },
              { label: 'Download Center', href: 'https://github.com/contextgo/contextgo-releases/releases' },
              { label: 'Release Notes', href: 'https://github.com/contextgo/contextgo-releases/releases' },
              { label: 'Main Blog', href: 'https://contextgo.io' },
            ],
          },
          {
            title: 'Resources',
            items: [
              { label: 'GitHub', href: 'https://github.com/contextgo/contextgo' },
              { label: 'Releases', href: 'https://github.com/contextgo/contextgo-releases' },
              { label: 'Issue Tracker', href: 'https://github.com/contextgo/contextgo-releases/issues' },
            ],
          },
        ],
        copyright: `Copyright ${new Date().getFullYear()} ContextGo.`,
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
      },
    }),
};

module.exports = config;
