import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(() => {
    // Check localStorage first, then system preference
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    // Update document class and localStorage
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark(!isDark);

  const theme = {
    isDark,
    toggleTheme,
    colors: isDark ? {
      bg: 'bg-dark-bg',
      bgSecondary: 'bg-dark-bg-secondary',
      bgAccent: 'bg-dark-bg-accent',
      text: 'text-dark-text',
      textSecondary: 'text-dark-text-secondary',
      textMuted: 'text-dark-text-muted',
      primary: 'text-dark-primary',
      primaryBg: 'bg-dark-primary',
      primaryHover: 'hover:bg-dark-primary-hover',
      secondary: 'text-dark-secondary',
      accent: 'text-dark-accent',
      success: 'text-dark-success',
      warning: 'text-dark-warning',
      error: 'text-dark-error',
      border: 'border-dark-border',
    } : {
      bg: 'bg-light-bg',
      bgSecondary: 'bg-light-bg-secondary',
      bgAccent: 'bg-light-bg-accent',
      text: 'text-light-text',
      textSecondary: 'text-light-text-secondary',
      textMuted: 'text-light-text-muted',
      primary: 'text-light-primary',
      primaryBg: 'bg-light-primary',
      primaryHover: 'hover:bg-light-primary-hover',
      secondary: 'text-light-secondary',
      accent: 'text-light-accent',
      success: 'text-light-success',
      warning: 'text-light-warning',
      error: 'text-light-error',
      border: 'border-light-border',
    }
  };

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
};