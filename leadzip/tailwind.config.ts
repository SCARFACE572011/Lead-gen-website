/**
 * tailwind.config.ts — LeadZip Design Token Reference
 *
 * NOTE: This project uses Tailwind CSS v4 which reads configuration from
 * src/app/globals.css via @theme inline directives. This file serves as a
 * reference for the brand tokens and is NOT auto-loaded by the build system.
 *
 * Brand colors are defined in globals.css as:
 *   --color-lz-navy, --color-lz-blue, --color-lz-blue-light,
 *   --color-lz-bg, --color-lz-border, --color-lz-muted
 *
 * To use in class names: text-lz-navy, bg-lz-blue, border-lz-border, etc.
 */

// Tailwind v4 ignores this file — config lives in globals.css @theme
// This file is kept for documentation and future v3 compatibility reference.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const config: Record<string, any> = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          navy: '#0F172A',
          blue: '#0369A1',
          lightBlue: '#0EA5E9',
        },
        leadzip: {
          bg: '#F8FAFC',
          border: '#E2E8F0',
          muted: '#94A3B8',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        card: '0 1px 3px rgba(15,23,42,0.08), 0 1px 2px rgba(15,23,42,0.06)',
        'card-hover': '0 8px 24px rgba(15,23,42,0.12)',
        sidebar: '1px 0 0 #E2E8F0',
      },
    },
  },
  plugins: [],
}

export default config

