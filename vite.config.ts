import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          homeLoanVsFd: path.resolve(__dirname, 'home-loan-vs-fd-calculator/index.html'),
          mutualFundRebalance: path.resolve(__dirname, 'mutual-fund-rebalance-india/index.html'),
          fdMaturityReinvestment: path.resolve(__dirname, 'fd-maturity-reinvestment-guide/index.html'),
          ltcgTaxHarvesting: path.resolve(__dirname, 'ltcg-tax-harvesting-india/index.html'),
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
