import React, { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark' | 'system'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: 'light' | 'dark'
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

interface ThemeProviderProps {
  children: React.ReactNode
  defaultTheme?: Theme
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultTheme = 'system'
}) => {
  const [theme, setTheme] = useState<Theme>(() => {
    // Try to get theme from localStorage, fallback to defaultTheme
    if (typeof window !== 'undefined') {
      const storedTheme = localStorage.getItem('espressobar-theme') as Theme
      return storedTheme || defaultTheme
    }
    return defaultTheme
  })

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    // Function to get the resolved theme
    const getResolvedTheme = () => {
      if (theme === 'system') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      }
      return theme
    }

    // Update resolved theme
    const updateResolvedTheme = () => {
      const resolved = getResolvedTheme()
      setResolvedTheme(resolved)

      // Apply theme to document
      const root = document.documentElement
      if (resolved === 'dark') {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    }

    // Initial theme application
    updateResolvedTheme()

    // Listen for system theme changes if using system theme
    let mediaQuery: MediaQueryList | undefined
    if (theme === 'system') {
      mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      mediaQuery.addEventListener('change', updateResolvedTheme)
    }

    // Save theme to localStorage
    localStorage.setItem('espressobar-theme', theme)

    // Cleanup
    return () => {
      if (mediaQuery) {
        mediaQuery.removeEventListener('change', updateResolvedTheme)
      }
    }
  }, [theme])

  const value: ThemeContextType = {
    theme,
    setTheme,
    resolvedTheme
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
