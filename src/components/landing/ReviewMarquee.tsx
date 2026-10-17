"use client";

import styles from "./landing.module.css";

const examples = [
  { name: "Nadia", job: "Desainer", jobEn: "Designer", rating: 5, id: "Semua dompet akhirnya bisa kulihat di satu tempat.", en: "Finally, I can see all my wallets in one place." },
  { name: "Raka", job: "Pengembang web", jobEn: "Web developer", rating: 4, id: "Foto struk bikin catat pengeluaran terasa lebih ringan.", en: "Receipt photos make tracking expenses feel easier." },
  { name: "Alya", job: "Content creator", jobEn: "Content creator", rating: 5, id: "Sekarang tahu uang bulan ini paling banyak ke mana.", en: "Now I can see where most of my money goes each month." },
  { name: "Dimas", job: "Fotografer", jobEn: "Photographer", rating: 4, id: "Melihat progres tabungan bikin target terasa lebih dekat.", en: "Seeing my savings progress makes my goal feel closer." },
];
export default function ReviewMarquee({ english }: { english: boolean }) {

  return <section id="voices" className={styles.reviewSection} aria-label={english ? "Sample review cards" : "Contoh kartu ulasan"}>
    <h2 className={styles.reviewHeading}>{english ? "Different routines. One place to keep track." : "Beda kebutuhan, satu tempat nyatet."}</h2>
    <p className={styles.reviewSubtitle}>{english ? "Everyday examples, rather than customer reviews." : "Contoh cerita sehari-hari, bukan ulasan pengguna."}</p>
    <div className={styles.reviewRail} tabIndex={0} aria-label={english ? "Sample reviews with AI avatars. Focus to pause." : "Contoh ulasan dengan avatar AI. Fokus untuk menjeda."}>
      <div className={styles.reviewTrack}>{[0, 1].map(copy => <div key={copy} className={styles.reviewGroup} aria-hidden={copy === 1}>{examples.map((review, index) => <figure className={styles.reviewCard} key={review.name}>
        <blockquote>“{english ? review.en : review.id}”</blockquote><figcaption><span className={styles.reviewAvatar} style={{ backgroundPosition: `${index * 100 / 3}% center` }} /><span><b>{review.name}</b><small>{english ? review.jobEn : review.job}</small></span><div className={styles.reviewStars} aria-label={`${review.rating} ${english ? "out of 5 stars (sample)" : "dari 5 bintang (contoh)"}`}>{Array.from({ length: 5 }, (_, star) => <span key={star} aria-hidden="true" data-filled={star < review.rating}>★</span>)}</div></figcaption>
      </figure>)}</div>)}</div>
    </div>
  </section>;
}







