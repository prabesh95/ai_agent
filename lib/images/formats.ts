export const FORMATS = {
  default: { label: 'Default portrait', width: 1200, height: 1800 },
  square: { label: 'Square post', width: 1080, height: 1080 },
  portrait: { label: 'Portrait post', width: 1080, height: 1350 },
  story: { label: 'Story / vertical', width: 1080, height: 1920 },
  landscape: { label: 'Landscape post', width: 1200, height: 675 },
  linkedin: { label: 'LinkedIn landscape', width: 1200, height: 627 },
} as const;
