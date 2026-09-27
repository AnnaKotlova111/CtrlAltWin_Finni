/**
 * Список заданий по трём темам.
 *
 * В демонстрационном режиме все задания открыты сразу, без привязки
 * к реальному времени. Пройденное задание можно пройти ещё раз –
 * это нужно, чтобы показать и правильный, и ошибочный вариант.
 */

import { Icon } from '../components/Icon';
import { Coin, Money, Thumb, TopBar } from '../components/ui';
import { QUESTS, THEMES, THEME_TITLES, type QuestTheme } from '../content/quests';
import { GRADE_TITLES } from '../engine/quests';
import { useStore } from '../state/store';
import type { Nav } from '../App';

const THEME_ICON: Record<QuestTheme, 'budget' | 'piggy' | 'shop'> = {
  budget: 'budget',
  savings: 'piggy',
  payments: 'shop',
};

const GRADE_TONE: Record<string, string> = {
  good: 'badge--needs',
  partial: 'badge--savings',
  weak: 'badge--warn',
};

export function QuestsScreen({ nav }: { nav: Nav }) {
  const { profile } = useStore();
  if (!profile) return null;

  const best = new Map<string, string>();
  for (const r of profile.questResults) {
    const prev = best.get(r.questId);
    if (!prev || r.grade === 'good' || (prev === 'weak' && r.grade === 'partial')) {
      best.set(r.questId, r.grade);
    }
  }

  const doneCount = new Set(profile.questResults.map((r) => r.questId)).size;

  return (
    <div className="screen">
      <TopBar title="Задания" subtitle={`Пройдено ${doneCount} из ${QUESTS.length}`} onBack={nav.onBack} />

      <section className="card card--soft">
        <p>
          В каждом задании – ситуация с выбором. После решения ты всегда получаешь объяснение,
          даже если решение оказалось неудачным
        </p>
      </section>

      {THEMES.map((theme) => (
        <section key={theme} className="stack--tight stack stack--cols stack--cols--wide">
          <div className="row" style={{ gap: 9, marginTop: 4 }}>
            <Icon name={THEME_ICON[theme]} size={20} style={{ color: 'var(--purple)' }} />
            <h3>{THEME_TITLES[theme]}</h3>
          </div>

          {QUESTS.filter((q) => q.theme === theme).map((q) => {
            const grade = best.get(q.id);
            return (
              <button
                key={q.id}
                className="linkrow linkrow--card"
                onClick={() => nav.go({ name: 'quest', id: q.id })}
              >
                <Thumb icon={THEME_ICON[theme]} tone={grade === 'good' ? 'green' : 'lavender'} />
                <span className="linkrow__text">
                  <b>{q.title}</b>
                  <span className="muted">{q.situation}</span>
                  {grade && (
                    <span className={`badge ${GRADE_TONE[grade]}`} style={{ marginTop: 6 }}>
                      <Icon name={grade === 'good' ? 'check' : grade === 'partial' ? 'info' : 'warning'} size={16} />
                      {GRADE_TITLES[grade as 'good']}
                    </span>
                  )}
                </span>
                <span className="linkrow__right">
                  {grade ? (
                    <span className="muted" style={{ fontSize: 13 }}>
                      ещё раз
                    </span>
                  ) : (
                    <span className="badge badge--gold">
                      <Coin size={13} />+{q.reward}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </section>
      ))}

      {/* Итог – в самом низу и одной строкой: сколько заработано, важно
          знать, но вести этим экран не стоит – главное здесь сами задания. */}
      {profile.questResults.length > 0 && (
        <div className="sumline">
          <Icon name="trophy" size={20} />
          <span>Заработано за задания</span>
          <b>
            <Money value={profile.questResults.reduce((s, r) => s + r.reward, 0)} showCoin={false} />
          </b>
        </div>
      )}
    </div>
  );
}
