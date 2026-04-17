import React, { createContext, useContext, useState } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(true);

  const toggleTheme = () => setIsDark(prev => !prev);

  const theme = isDark
    ? {
        background: '#0F1217',
        card: '#1A1D23',
        text: '#FFFFFF',
        subText: '#A0AEC0',
        primary: '#B0D1FF',
        danger: '#FF5247',
        iconBg: '#2C3036',
        border: '#262A31',
        activeTab: '#B0D1FF',
      }
    : {
        background: '#F7FAFC',
        card: '#FFFFFF',
        text: '#1A202C',
        subText: '#718096',
        primary: '#3182CE',
        danger: '#E53E3E',
        iconBg: '#EDF2F7',
        border: '#E2E8F0',
        activeTab: '#3182CE',
      };

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);