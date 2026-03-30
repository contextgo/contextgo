import ContextGoSelect from '@/renderer/components/base/ContextGoSelect';
import type { SelectHandle } from '@arco-design/web-react/es/Select/interface';
import React, { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { changeLanguage } from '@/renderer/services/i18n';

const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();
  const selectRef = useRef<SelectHandle>(null);

  const handleLanguageChange = useCallback((value: string) => {
    // 切换前先 blur 触发元素，避免弹层和语言切换竞争布局
    // Blur before switching to avoid dropdown and language change fighting for layout
    selectRef.current?.blur?.();

    const applyLanguage = () => {
      changeLanguage(value).catch((error: Error) => {
        console.error('Failed to change language:', error);
      });
    };

    if (typeof window !== 'undefined' && 'requestAnimationFrame' in window) {
      // 延迟到下一帧执行，确保 DOM 动画已完成 / defer to next frame so DOM animations finish
      window.requestAnimationFrame(() => window.requestAnimationFrame(applyLanguage));
    } else {
      setTimeout(applyLanguage, 0);
    }
  }, []);

  return (
    <div className='flex items-center gap-8px'>
      <ContextGoSelect ref={selectRef} className='w-160px' value={i18n.language} onChange={handleLanguageChange}>
        <ContextGoSelect.Option value='zh-CN'>简体中文</ContextGoSelect.Option>
        <ContextGoSelect.Option value='zh-TW'>繁體中文</ContextGoSelect.Option>
        <ContextGoSelect.Option value='ja-JP'>日本語</ContextGoSelect.Option>
        <ContextGoSelect.Option value='ko-KR'>한국어</ContextGoSelect.Option>
        <ContextGoSelect.Option value='tr-TR'>Türkçe</ContextGoSelect.Option>
        <ContextGoSelect.Option value='en-US'>English</ContextGoSelect.Option>
      </ContextGoSelect>
    </div>
  );
};

export default LanguageSwitcher;
