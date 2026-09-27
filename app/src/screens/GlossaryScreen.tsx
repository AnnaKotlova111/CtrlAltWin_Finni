/**
 * Короткий справочный раздел: что значит слово.
 *
 * Каждый термин – одно-два простых предложения плюс пример из игры.
 */

import { useState } from 'react';

import { Icon } from '../components/Icon';
import { TopBar } from '../components/ui';
import { GLOSSARY } from '../content/glossary';
import { useStore } from '../state/store';
import type { Nav } from '../App';

export function GlossaryScreen({ nav }: { nav: Nav }) {
  const { profile, dispatch } = useStore();
  const [open, setOpen] = useState<string | null>(null);

  const toggle = (id: string) => {
    setOpen((v) => (v === id ? null : id));
    dispatch({ type: 'glossary/seen', id });
  };

  return (
    <div className="screen">
      <TopBar
        title="Финсловарь"
        subtitle={`Прочитано ${profile?.glossarySeen.length ?? 0} из ${GLOSSARY.length}`}
        onBack={nav.onBack}
      />

      <section className="card card--soft">
        <p>Если в игре встретилось непонятное слово – оно объяснено здесь</p>
      </section>

      <div className="stack--tight stack stack--cols stack--cols--wide">
        {GLOSSARY.map((t) => {
          const isOpen = open === t.id;
          const seen = profile?.glossarySeen.includes(t.id);
          return (
            <div key={t.id} className="card term">
              <button className="term__head" onClick={() => toggle(t.id)} aria-expanded={isOpen}>
                <Icon
                  name={seen ? 'check' : 'glossary'}
                  size={20}
                  style={{ color: seen ? 'var(--green)' : 'var(--lavender)' }}
                />
                <b>{t.title}</b>
                <Icon name={isOpen ? 'minus' : 'plus'} size={18} style={{ marginLeft: 'auto', color: 'var(--ink-mute)' }} />
              </button>
              {isOpen && (
                <div className="term__body">
                  <p>{t.text}</p>
                  <p className="muted" style={{ marginTop: 8 }}>
                    <b>Например: </b>
                    {t.example}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
