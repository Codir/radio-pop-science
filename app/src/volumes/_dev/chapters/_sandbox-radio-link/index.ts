import { defineChapter } from '@/engine/api';

/**
 * Sandbox of the radio volume's world (P7: a chapter of `_dev`, never on the site): the shared pieces of
 * `@radio/shared/**` in a real browser, with the measurements of `qa/measure.mjs`. Batch 2 grows it step by step;
 * B1b: the camera's eye (decision 24) feeding a floating screen, from two director shots. All the text of the
 * sandbox is here; the scene has no words of its own.
 */
export const SANDBOX = {
  steps: {
    eye: {
      title: 'Око камери',
      blurb: 'Камера дивиться на подвір’я окремим проходом, і її кадр одразу йде на плаваючий екран.',
    },
    far: {
      title: 'Той самий кадр здалеку',
      blurb: 'Та сама сцена з іншого боку: картинка на екрані не залежить від того, звідки дивиться читач.',
    },
  },
  labels: { eye: 'Око камери' },
} as const;

export default defineChapter({
  id: '_sandbox-radio-link',
  order: 9020,
  group: 'em',
  title: 'Пісочниця: лінія тому «Радіо»',
  subtitle: 'Око камери, екран і виміри',
  axisLabel: '10¹ m',
  axisValue: 1,
  theme: { accent: 'sky', sky: 'dusk', mood: 'diorama' },
  steps: Object.entries(SANDBOX.steps).map(([id, s]) => ({ id, title: s.title, blurb: s.blurb })),
  load: () => import('./scene'),
  dev: true,
});
