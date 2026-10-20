/**
 * Настройки: доступность и режим работы.
 *
 * Звуки и анимации можно отключить. Критически важная информация
 * никогда не передаётся только звуком или только цветом.
 */

import { Icon } from '../components/Icon';
import { PetPortrait } from '../components/PetView';
import { TopBar } from '../components/ui';
import { species } from '../content/pets';
import { useStore } from '../state/store';
import type { Nav } from '../App';

function Switch({
  title,
  hint,
  checked,
  onChange,
}: {
  title: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="switchrow">
      <span>
        <b>{title}</b>
        <span className="muted">{hint}</span>
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function SettingsScreen({ nav }: { nav: Nav }) {
  const { profile, dispatch } = useStore();
  if (!profile) return null;

  const s = species(profile.pet.species);
  const set = (patch: Partial<typeof profile.settings>) => dispatch({ type: 'settings', patch });

  return (
    <div className="screen">
      <TopBar title="Настройки" onBack={nav.onBack} />

      <section className="card card--hero">
        <div className="row" style={{ gap: 14 }}>
          <PetPortrait speciesId={profile.pet.species} color={profile.pet.color} stage={profile.pet.stage} size={74} />
          <span className="linkrow__text">
            <b style={{ fontSize: 'var(--fs-lg)' }}>{profile.pet.name}</b>
            <span className="muted">
              {s.name} · стадия {profile.pet.stage}
            </span>
            <span className="muted">Игрок: {profile.playerName}</span>
          </span>
        </div>
      </section>

      <section className="card">
        <div className="card__title">
          <Icon name="paw" size={20} />
          Доступность
        </div>
        <div className="stack--tight stack" style={{ marginTop: 6 }}>
          <Switch
            title="Анимации"
            hint="Плавное движение питомца и переходов"
            checked={profile.settings.animations}
            onChange={(v) => set({ animations: v })}
          />
          <Switch
            title="Крупный текст"
            hint="Увеличивает размер всех надписей"
            checked={profile.settings.largeText}
            onChange={(v) => set({ largeText: v })}
          />
        </div>
      </section>

      <section className="card">
        <div className="card__title">
          <Icon name="play" size={20} />
          Демонстрационный режим
        </div>
        <Switch
          title="Проходить сценарий подряд"
          hint="Все задания открыты, недели переключаются без ожидания"
          checked={profile.settings.demoMode}
          onChange={(v) => set({ demoMode: v })}
        />
      </section>

      <button className="btn btn--secondary" onClick={() => nav.go({ name: 'adult' })}>
        <Icon name="adult" size={20} />
        Раздел для взрослого
      </button>

      <p className="muted center" style={{ fontSize: 13 }}>
        Питомец Финни. Прототип просветительского приложения
      </p>
    </div>
  );
}
