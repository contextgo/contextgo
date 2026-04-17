import Link from '@docusaurus/Link';
import type { ReactNode } from 'react';
import styles from './DocsLanding.module.css';

type Card = {
  kicker: string;
  title: string;
  body: string;
  href: string;
  cta: string;
};

type DocsLandingProps = {
  badge: string;
  eyebrow: string;
  title: string;
  body: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref: string;
  secondaryLabel: string;
  valueTitle: string;
  valueBody: string;
  valueCards: Card[];
  mapTitle: string;
  mapBody: string;
  mapCards: Card[];
  useCasesTitle: string;
  useCasesBody: string;
  useCaseCards: Card[];
  calloutTitle: string;
  calloutBody: string;
  calloutItems: string[];
};

const SectionHeader = ({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) => (
  <div className={styles.sectionHeader}>
    <div className={styles.sectionEyebrow}>{eyebrow}</div>
    <h2 className={styles.sectionTitle}>{title}</h2>
    <div className={styles.sectionBody}>{body}</div>
  </div>
);

const CardGrid = ({ cards, threeUp = false }: { cards: Card[]; threeUp?: boolean }) => (
  <div className={threeUp ? styles.gridThree : styles.gridTwo}>
    {cards.map((card) => (
      <article key={card.title} className={styles.card}>
        <div className={styles.cardKicker}>{card.kicker}</div>
        <h3 className={styles.cardTitle}>{card.title}</h3>
        <div className={styles.cardBody}>{card.body}</div>
        <Link className={styles.cardLink} href={card.href}>
          {card.cta}
        </Link>
      </article>
    ))}
  </div>
);

export default function DocsLanding(props: DocsLandingProps): ReactNode {
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.badgeRow}>
          <span className={styles.badge}>{props.badge}</span>
        </div>
        <div className={styles.eyebrow}>{props.eyebrow}</div>
        <h1 className={styles.heroTitle}>{props.title}</h1>
        <div className={styles.heroBody}>{props.body}</div>
        <div className={styles.heroActions}>
          <Link className={styles.heroPrimary} href={props.primaryHref}>
            {props.primaryLabel}
          </Link>
          <Link className={styles.heroSecondary} href={props.secondaryHref}>
            {props.secondaryLabel}
          </Link>
        </div>
      </section>

      <section className={styles.section}>
        <SectionHeader eyebrow='Why It Matters' title={props.valueTitle} body={props.valueBody} />
        <CardGrid cards={props.valueCards} threeUp />
      </section>

      <section className={styles.section}>
        <SectionHeader eyebrow='Product Spine' title={props.mapTitle} body={props.mapBody} />
        <CardGrid cards={props.mapCards} />
      </section>

      <section className={styles.section}>
        <SectionHeader eyebrow='Use Cases' title={props.useCasesTitle} body={props.useCasesBody} />
        <CardGrid cards={props.useCaseCards} />
      </section>

      <section className={styles.callout}>
        <h3 className={styles.calloutTitle}>{props.calloutTitle}</h3>
        <div>{props.calloutBody}</div>
        <ul className={styles.list}>
          {props.calloutItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
