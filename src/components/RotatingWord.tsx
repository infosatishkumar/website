"use client";

import { useEffect, useState } from "react";

export default function RotatingWord({ words }: { words: string[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setIndex((i) => (i + 1) % words.length),
      2200,
    );
    return () => clearInterval(id);
  }, [words.length]);

  return (
    <span className="relative inline-grid overflow-hidden align-bottom">
      {words.map((word, i) => (
        <em
          key={word}
          aria-hidden={i !== index}
          className="col-start-1 row-start-1 text-accent transition-all duration-700 ease-[cubic-bezier(0.2,0.7,0.2,1)]"
          style={{
            opacity: i === index ? 1 : 0,
            transform: `translateY(${i === index ? 0 : i < index ? -100 : 100}%)`,
          }}
        >
          {word}
        </em>
      ))}
    </span>
  );
}
