# Том «Радіоелектроніка» — план робіт (черги E1…E7)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Збудувати новий курс «Радіоелектроніка · Від резистора до підсилювача» (том `electronics`) на рушії `tech`
у форматі «шлях»: стенд, на який читач ставить деталі й бачить їхній вплив світлом, звуком і осцилограмою, з
наскрізною ниткою — підсилювачем, що грає музику. Будуємо поступово, кожна черга закінчується оновленим сайтом.

**Architecture:** Том живе в `app/src/volumes/electronics/`. Одна загальна модель кола (`sim/core`, чистий
TypeScript, модифікований вузловий аналіз, постійний і перехідний режими), перевірена ngspice
(`tools/ref-models/electronics/`). Стенд, прилади й власний звуковий вихід — `shared/**`; модель на звуковій
частоті рахує фоновий потік. Сайт — профіль `tools/site` з `--volume electronics` у підкаталозі `electronics/`
сайту поруч із «Радіо».

**Tech Stack:** TypeScript 6, three.js 0.187, Vite 8, vitest 5, ESLint 10; Web Audio; Python 3.12 (numpy, scipy) і
ngspice для еталона; Node 24, pnpm 12.18 (corepack); playwright-core з Google Chrome для перевірок у браузері;
GitHub Actions і GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-11-20-electronics-volume-design.md` («проєкт»). Виконавець читає проєкт разом
із завданням.

**Обмеження:** `.superpowers/sdd/2026-11-20-electronics/global-constraints.md` — спільні для всіх завдань (мова,
формули, безпека, чесність моделі, репозиторій, середовище). Робочий приклад процесу й коду — том `radio`.

## Черги

| Черга | Файл завдань | Що дає | Стан |
|---|---|---|---|
| E1 | `2026-11-20-electronics/batch-E1.md` | каркас, сайт `/electronics/`, модель кола з еталоном ngspice, документи тому, проба звуку | у роботі |
| E2 | пишеться після E1 | стенд: кімната, плата з гніздами, лоток, деталі, вставляння, нагрів і поломки, мультиметр, осцилограф, звук; пісочниця | — |
| E3 | пишеться після E2 | пілот: `prologue`, `meter`, `resistor`, `resistor-pick` | — |
| E4 | — | `divider`, `capacitor`, `capacitor-kinds`, `filter` | — |
| E5 | — | `diode`, `led` | — |
| E6 | — | `transistor`, `amplifier` | — |
| E7 | — | `build`, `lab`, далі гілки | — |

Кожну наступну чергу пишемо, коли попередня влита: її завдання спираються на те, що справді збудовано (README
моделі й світу, звіт черги), а не на прогноз.

## Ворота черги

```bash
# прелюдія, потім:
cd app && pnpm typecheck && pnpm lint && pnpm test && pnpm build && cd ..
python3 tools/content/doccheck.py --all
python3 docs/volumes/radio/test_check.py && python3 docs/volumes/radio/check.py
python3 docs/volumes/electronics/test_check.py && python3 docs/volumes/electronics/check.py   # з E1-8
node tools/site/build.mjs --volume electronics --out "$HOME/.cache/radio-pop-science/site-electronics" --sub radio-pop-science/electronics
```

Після воріт контролер надсилає `main` в `origin` і перевіряє опублікований сайт
(`https://codir.github.io/radio-pop-science/electronics/`).
