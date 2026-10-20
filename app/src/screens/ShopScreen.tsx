/**
 * Покупки: товары и действия для питомца.
 *
 * Перед покупкой видно цену, категорию и предполагаемое влияние на питомца.
 * Покупка требует подтверждения. Отрицательный баланс невозможен: если
 * финкоинов не хватает, приложение объясняет, чего именно и что можно сделать.
 */

import { useMemo, useState } from 'react';

import { Icon } from '../components/Icon';
import { Confirm, KindBadge, Money, Thumb, TopBar } from '../components/ui';
import { SHOP, type ShopItem } from '../content/shop';
import { shopMood, shopRemark } from '../content/remarks';
import { PetSpeech } from '../components/PetSpeech';
import { canAfford, money } from '../engine/economy';
import { useStore } from '../state/store';
import type { Nav } from '../App';
import type { CostKind } from '../engine/types';

type Filter = 'all' | CostKind;

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Всё' },
  { id: 'needs', label: 'Обязательное' },
  { id: 'wants', label: 'Желаемое' },
];

export function ShopScreen({ nav }: { nav: Nav }) {
  const { profile, dispatch, totalSavings } = useStore();
  const [filter, setFilter] = useState<Filter>('all');
  const [pending, setPending] = useState<ShopItem | null>(null);

  const items = useMemo(
    () => (filter === 'all' ? SHOP : SHOP.filter((i) => i.kind === filter)),
    [filter]
  );

  if (!profile) return null;

  const plan = profile.period.planConfirmed ? profile.period.plan : null;
  const remark = shopRemark(
    shopMood({
      balance: profile.balance,
      cheapestPrice: Math.min(...SHOP.map((i) => i.price)),
      planConfirmed: profile.period.planConfirmed,
      boughtNeeds: profile.period.purchases.some((p) => p.kind === 'needs'),
      wantsLeft: plan ? plan.wants - profile.period.fact.wants : null,
    }),
    profile.pet.species
  );

  return (
    <div className="screen">
      <TopBar title="Покупки" subtitle={`Баланс: ${money(profile.balance)}`} onBack={nav.onBack} />

      {/* Остаток по плану – две колонки: подпись сверху, сумма снизу.
          Так ничего не переносится и видно сразу, на что ещё есть деньги. */}
      {plan && (
        <section className="card card--soft card--tight">
          <span className="planleft__cap">Осталось по плану</span>
          <div className="planleft">
            <div className="planleft__item">
              <span className="planleft__name">Обязательное</span>
              <b className="planleft__sum">
                <Icon name="bowl" size={18} />
                <Money value={Math.max(0, plan.needs - profile.period.fact.needs)} showCoin={false} />
              </b>
            </div>
            <div className="planleft__item">
              <span className="planleft__name">Желаемое</span>
              <b className="planleft__sum">
                <Icon name="ball" size={18} />
                <Money value={Math.max(0, plan.wants - profile.period.fact.wants)} showCoin={false} />
              </b>
            </div>
          </div>
        </section>
      )}

      {/* Питомец смотрит на ситуацию в лавке и говорит в своём характере. */}
      <PetSpeech line={remark.says} note={remark.note} size={60} live />

      <div className="chiprow chiprow--filters" role="tablist" aria-label="Категории">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={filter === f.id}
            className={`chip ${filter === f.id ? 'is-on' : ''}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="stack--tight stack stack--cols">
        {items.map((item) => {
          const owned = profile.ownedItems[item.id] ?? 0;
          const soldOut = !item.repeatable && owned > 0;
          const afford = canAfford(profile.balance, item.price, totalSavings);
          return (
            <article key={item.id} className="card shopitem">
              <Thumb icon={item.icon} tone={item.kind === 'needs' ? 'green' : 'lavender'} />
              <b className="shopitem__title">{item.title}</b>
              <div className="shopitem__marks">
                <KindBadge kind={item.kind} />
                {item.repeatable && (
                  <span className="badge">
                    <Icon name="refresh" size={14} />
                    каждую неделю
                  </span>
                )}
              </div>
              {/* Цена и кнопка – одной колонкой справа, как ценник на полке:
                  сначала видно, сколько стоит, и только потом – как купить. */}
              <div className="shopitem__buy">
                <span className="price">
                  {item.oldPrice && (
                    <s className="price__old">
                      <Money value={item.oldPrice} showCoin={false} />
                    </s>
                  )}
                  <Money value={item.price} />
                </span>
                <button
                  className={afford.ok && !soldOut ? 'btn btn--sm' : 'btn btn--sm btn--secondary'}
                  onClick={() => setPending(item)}
                  disabled={soldOut}
                >
                  {soldOut ? 'Уже есть' : 'Купить'}
                </button>
              </div>
              <div className="shopitem__foot">
                <span className="effect">
                  <Icon name="heart" size={15} />
                  {item.impact}
                </span>
                {!afford.ok && !soldOut && (
                  <span className="badge badge--warn">
                    <Icon name="warning" size={15} />
                    не хватает {money(afford.missing)}
                  </span>
                )}
                <p className="shopitem__why">
                  <Icon name="info" size={14} />
                  {item.why}
                </p>
              </div>
            </article>
          );
        })}
      </div>

      {profile.period.purchases.length > 0 && (
        <section className="card">
          <div className="card__title">
            <Icon name="calendar" size={20} />
            Куда ушли мои финкоины на этой неделе
          </div>
          <div className="stack--tight stack" style={{ marginTop: 6 }}>
            {profile.period.purchases.map((p) => (
              <div key={p.id} className="row row--between historyrow">
                <span className="row" style={{ gap: 8 }}>
                  <Icon name={p.kind === 'needs' ? 'check' : 'star'} size={16} style={{ color: p.kind === 'needs' ? 'var(--green)' : 'var(--pink)' }} />
                  {p.title}
                </span>
                <Money value={-p.price} showCoin={false} />
              </div>
            ))}
          </div>
        </section>
      )}

      <Confirm
        open={pending !== null}
        title={pending ? `Купить: ${pending.title}?` : ''}
        confirmLabel="Купить"
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (pending) dispatch({ type: 'buy', itemId: pending.id });
          setPending(null);
        }}
      >
        {pending && (
          <div className="stack--tight stack">
            <div className="row row--between">
              <span>Цена</span>
              <Money value={pending.price} />
            </div>
            <div className="row row--between">
              <span>Категория</span>
              <KindBadge kind={pending.kind} />
            </div>
            <div className="row row--between">
              <span>Повлияет на питомца</span>
              <b>{pending.impact}</b>
            </div>
            <div className="row row--between">
              <span>Баланс станет</span>
              <Money value={Math.max(0, profile.balance - pending.price)} />
            </div>
          </div>
        )}
      </Confirm>
    </div>
  );
}
