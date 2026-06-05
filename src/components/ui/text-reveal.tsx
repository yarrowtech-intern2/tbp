import React, { useEffect, useRef, useState } from 'react';
import './text-reveal.css';

type TextRevealProps = {
  children: string;
  className?: string;
};

export const TextReveal: React.FC<TextRevealProps> = ({ children, className }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.35, rootMargin: '0px 0px -10% 0px' },
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, []);

  const words = children.trim().split(/\s+/);

  return (
    <div
      ref={ref}
      className={`text-reveal${visible ? ' is-visible' : ''}${className ? ` ${className}` : ''}`}
      aria-label={children}
    >
      {words.map((word, index) => (
        <span
          key={`${word}-${index}`}
          className="text-reveal-word"
          style={{ transitionDelay: `${index * 55}ms` }}
          aria-hidden="true"
        >
          {word}
          {index < words.length - 1 ? '\u00A0' : ''}
        </span>
      ))}
    </div>
  );
};
