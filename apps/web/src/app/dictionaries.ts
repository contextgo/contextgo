import 'server-only';

const dictionaries = {
  en: () => import('@/dictionaries/en').then((module) => module.en),
  zh: () => import('@/dictionaries/zh').then((module) => module.zh),
};

export const getDictionary = async (locale: 'en' | 'zh') => dictionaries[locale]();
