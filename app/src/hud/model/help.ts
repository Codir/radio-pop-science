/**
 * Content of the help overlay («Керування»), shared by the WebGL view (`hud/overlays/help.ts`) and the DOM view
 * (`hud-dom/overlays/help.ts`): sections of key caps and what they do — touch-first on a coarse pointer (what a
 * finger can do, first and in full; keys only where a keyboard is likely), else mouse, touch and keyboard.
 */
import type { VolumeManifest } from '@/engine/api';
import type { IconName } from '@/ui3d';
import { chapterWords } from '../journey';

export interface HelpSection {
  readonly icon: IconName;
  readonly title: string;
  readonly rows: readonly (readonly [keys: readonly string[], text: string])[];
}

export interface HelpModel {
  readonly touchFirst: boolean;
  readonly sections: readonly HelpSection[];
  /** A line under the sections (desktop): the journey map's gestures and keys. */
  readonly note: string | null;
}

export function helpModel(
  device: { readonly pointer: string; readonly formFactor: string },
  volume: VolumeManifest | null,
): HelpModel {
  const words = volume ? chapterWords(volume) : (['розділ', 'розділи', 'розділів'] as const);
  if (device.pointer === 'coarse') {
    const sections: HelpSection[] = [
      {
        icon: 'touch',
        title: 'Дотик',
        rows: [
          [['1 палець'], 'обертати сцену, тягнути об’єкти й повзунки'],
          [['2 пальці'], 'наблизити чи віддалити (щипок)'],
          [['дотик'], 'кнопки, гарячі точки, об’єкти з блакитним контуром'],
          [['утримати'], 'назва об’єкта у підказці'],
        ],
      },
      {
        icon: 'layers',
        title: 'Панель кроку',
        rows: [
          [['потягнути'], 'вище — читати, нижче — бачити сцену'],
          [['вкладки'], '«Текст», «Керування», «Графіки» кроку'],
          [['Далі'], 'наступний крок; стрілка ліворуч — попередній'],
        ],
      },
      {
        icon: 'map',
        title: 'Мапа подорожі',
        rows: [
          [['тягнути'], 'мандрувати шляхом'],
          [['щипок'], 'змінити масштаб'],
          [['дотик'], words[0] === 'глава' ? 'картка глави з її кроками' : 'картка розділу з його кроками'],
        ],
      },
    ];
    if (device.formFactor !== 'phone')
      sections.push({
        icon: 'keyboard',
        title: 'Клавіатура (якщо є)',
        rows: [
          [['←', '→'], 'попередній і наступний крок'],
          [['M'], 'мапа подорожі'],
          [['Esc'], 'закрити вікно'],
        ],
      });
    return { touchFirst: true, sections, note: null };
  }
  // (volume 1's map has hubs with satellites: the plant types and the laboratories)
  const branches = volume?.format === 'path' ? '' : ', ↓ ↑ — типи станцій і лабораторії';
  return {
    touchFirst: false,
    sections: [
      {
        icon: 'mouse',
        title: 'Миша',
        rows: [
          [['тягнути'], 'обертати сцену навколо об’єкта'],
          [['колесо'], 'наблизити або віддалити'],
          [['клац'], 'кнопки, гарячі точки, об’єкти з блакитним контуром'],
          [['навести'], 'назва об’єкта у підказці'],
        ],
      },
      {
        icon: 'touch',
        title: 'Дотик',
        rows: [
          [['1 палець'], 'обертати сцену, тягнути повзунки'],
          [['2 пальці'], 'масштаб (щипок) і зсув'],
          [['дотик'], 'кнопки й гарячі точки'],
        ],
      },
      {
        icon: 'keyboard',
        title: 'Клавіатура',
        rows: [
          [['←', '→'], 'попередній і наступний крок'],
          [['Home', 'End'], `перший і останній крок ${words[0] === 'глава' ? 'глави' : 'розділу'}`],
          [['M'], 'мапа подорожі'],
          [['F'], 'на весь екран'],
          [['Tab'], 'перейти до наступного елемента керування'],
          [['Enter'], 'натиснути вибраний елемент'],
          [['Esc'], 'закрити вікно або зняти вибір'],
        ],
      },
    ],
    note: `На мапі подорожі: тягніть, щоб мандрувати шляхом, колесо змінює масштаб, ← → обирають сусідні ${words[1]}${branches}, Enter відкриває ${words[0] === 'глава' ? 'главу' : 'розділ'}.`,
  };
}
