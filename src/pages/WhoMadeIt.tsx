import React from 'react';
import './whomadeit.css';

type CreditSection = {
  title: string;
  names: string[];
};

const CREDIT_SECTIONS: CreditSection[] = [
  {
    title: 'Lead developers',
    names: ['Srijon Karmakar', 'Subhranil Banarjee'],
  },
  {
    title: 'Assistant developers',
    names: ['Santu Pramanik', 'Raktim Maiti', 'Koushik Bala', 'Salini Chowdhury', 'Dibbyapriya Jana', 'Rahul Panja', 'Nandini Biswas', 'Swapnil'],
  },
  {
    title: 'System Architecture',
    names: ['Srijon Karmakar'],
  },
  {
    title: 'Database & Logic',
    names: ['Subhranil Banerjee'],
  },
  {
    title: 'UI/UX design',
    names: ['Srijon Karmakar', 'Salini Chowdhury'],
  },
  {
    title: 'Assistant Frontend development',
    names: ['Koushik Bala', 'Raktim Maiti', 'Rahul Panja'],
  },
  {
    title: 'Assistant Backend development',
    names: ['Dibyapriya Jana', 'Santu Pramanik'],
  },
  {
    title: 'Machine Learning & AI',
    names: ['Subhranil Banerjee', 'Swapnil'],
  },
  {
    title: 'Graphics, Visuals & animation',
    names: ['Srijon Karmakar'],
  },
  {
    title: 'Management',
    names: ['Attreyi Das'],
  },
  {
    title: 'Promotion',
    names: ['Aeroth pvt ltd'],
  },
  {
    title: 'Special Thanks To',
    names: ['All stuffs of lighthouse, Esplanade, Kolkata-700069'],
  },
  {
    title: 'Special Thanks',
    names: ['Our travellers, Partners, communities'],
  },
];

export const WhoMadeIt: React.FC = () => {
  return (
    <main className="whomadeit-page" aria-label="Developer credits page">
      <div className="whomadeit-vignette" aria-hidden="true" />
      <section className="whomadeit-credits" aria-labelledby="whomadeit-title">
        <div className="whomadeit-roll">
          <h1 id="whomadeit-title">The Better Pass</h1>
          <p className="whomadeit-subtitle">Crafted with care by</p>
          <p className="whomadeit-intro">Yarrowtech .co.</p>

          {CREDIT_SECTIONS.map((section) => (
            <div className="whomadeit-section" key={section.title}>
              <h2>{section.title}</h2>
              {section.names.map((name) => (
                <p key={`${section.title}-${name}`}>{name}</p>
              ))}
            </div>
          ))}

          <p className="whomadeit-thank">Thank you</p>
        </div>
      </section>
    </main>
  );
};
