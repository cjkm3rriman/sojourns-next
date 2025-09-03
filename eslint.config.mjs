import path from 'node:path';
import { FlatCompat } from '@eslint/eslintrc';

// Use FlatCompat to consume legacy shareable configs like "next/core-web-vitals" with ESLint v9
const compat = new FlatCompat({ baseDirectory: path.resolve() });

export default [
  // Next.js recommended rules (Core Web Vitals)
  ...compat.extends('next/core-web-vitals'),
  // General recommended settings can be added here as needed
  {
    ignores: ['node_modules/', '.next/', 'dist/', 'coverage/'],
  },
];
